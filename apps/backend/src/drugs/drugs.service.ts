import {
  Injectable,
  Logger,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import Redis from 'ioredis';

import { Medication, AuditLog } from '../entities';
import { REDIS_CLIENT } from '../redis/redis.module';
import { CreatePrescriptionDto, InteractionSeverity } from './drugs.dto';

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_BASE = 'https://api.fda.gov/drug';

@Injectable()
export class DrugsService {
  private readonly logger = new Logger(DrugsService.name);

  constructor(
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── DRUG SEARCH (RxNorm) ─────────────────────────────────

  async searchDrugs(query: string) {
    if (!query || query.length < 2) return [];

    const cacheKey = `drug:search:${query.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await axios.get(`${RXNORM_BASE}/drugs.json`, {
        params: { name: query },
        timeout: 5000,
      });

      const conceptGroups = res.data?.drugGroup?.conceptGroup || [];
      const results: { rxcui: string; name: string; tty: string }[] = [];

      for (const group of conceptGroups) {
        if (group.conceptProperties) {
          for (const prop of group.conceptProperties) {
            results.push({
              rxcui: prop.rxcui,
              name: prop.name,
              tty: prop.tty || group.tty,
            });
          }
        }
      }

      const deduped = results.slice(0, 10);
      await this.redis.setex(cacheKey, 86400, JSON.stringify(deduped)); // 24h cache
      return deduped;
    } catch (err) {
      this.logger.warn(`RxNorm search failed for "${query}": ${err}`);
      return [];
    }
  }

  // ─── INTERACTION CHECK (RxNorm Interaction API) ───────────

  async checkInteractions(rxcuis: string[]) {
    if (rxcuis.length < 2) return { interactions: [], severity: null };

    const sorted = [...rxcuis].sort();
    const cacheKey = `drug:ix:${sorted.join(',')}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const res = await axios.get(`${RXNORM_BASE}/interaction/list.json`, {
        params: { rxcuis: sorted.join('+') },
        timeout: 8000,
      });

      const interactionPairs: Array<{
        drug1: string;
        drug2: string;
        description: string;
        severity: InteractionSeverity;
      }> = [];

      const fullData = res.data?.fullInteractionTypeGroup || [];
      for (const group of fullData) {
        for (const interaction of group.fullInteractionType || []) {
          for (const pair of interaction.interactionPair || []) {
            const drug1 = pair.interactionConcept?.[0]?.minConceptItem?.name || 'Unknown';
            const drug2 = pair.interactionConcept?.[1]?.minConceptItem?.name || 'Unknown';
            const desc = pair.description || 'Potential interaction';
            const severity = this.mapSeverity(pair.severity || '');

            interactionPairs.push({
              drug1,
              drug2,
              description: desc,
              severity,
            });
          }
        }
      }

      // Determine overall severity
      let overallSeverity: InteractionSeverity | null = null;
      if (interactionPairs.some((p) => p.severity === InteractionSeverity.HIGH)) {
        overallSeverity = InteractionSeverity.HIGH;
      } else if (interactionPairs.some((p) => p.severity === InteractionSeverity.MODERATE)) {
        overallSeverity = InteractionSeverity.MODERATE;
      } else if (interactionPairs.length > 0) {
        overallSeverity = InteractionSeverity.LOW;
      }

      const result = {
        interactions: interactionPairs,
        severity: overallSeverity,
        count: interactionPairs.length,
      };

      await this.redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1h cache
      return result;
    } catch (err) {
      this.logger.warn(`RxNorm interaction check failed: ${err}`);
      return { interactions: [], severity: null, count: 0, error: 'RxNorm API unavailable' };
    }
  }

  // ─── PRESCRIBE WITH INTERACTION CHECK ─────────────────────

  async prescribe(
    patientId: string,
    dto: CreatePrescriptionDto,
    doctorId: string,
    ip?: string,
  ) {
    // Get patient's current active medications
    const currentMeds = await this.medicationRepo.find({
      where: { patient_id: patientId, is_active: true },
    });

    // If the new drug has an RxCUI, check for interactions against current meds
    if (dto.rxcui) {
      const currentRxcuis = currentMeds
        .filter((m) => m.rxnorm_code)
        .map((m) => m.rxnorm_code!);

      if (currentRxcuis.length > 0) {
        const allRxcuis = [...currentRxcuis, dto.rxcui];
        const interactionResult = await this.checkInteractions(allRxcuis);

        // Block if HIGH severity and not acknowledged
        if (
          interactionResult.severity === InteractionSeverity.HIGH &&
          !dto.acknowledgeInteractions
        ) {
          throw new ConflictException({
            statusCode: 409,
            message: 'Drug interaction detected — HIGH severity',
            interactions: interactionResult.interactions,
            severity: interactionResult.severity,
          });
        }
      }
    }

    // Save the prescription
    const medication = this.medicationRepo.create({
      patient_id: patientId,
      drug_name: dto.drugName,
      rxnorm_code: dto.rxcui || undefined,
      dosage: dto.dosage || undefined,
      frequency: dto.frequency || undefined,
      is_active: true,
    } as Partial<Medication>);
    const saved = await this.medicationRepo.save(medication as Medication);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'prescription_created',
        actor_user_id: doctorId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'medication',
      }),
    );

    this.logger.log(`Prescription created: ${(saved as Medication).id} for patient ${patientId} by doctor ${doctorId}`);
    return saved;
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private mapSeverity(rawSeverity: string): InteractionSeverity {
    const s = rawSeverity.toLowerCase();
    if (s.includes('high') || s.includes('severe') || s.includes('critical')) {
      return InteractionSeverity.HIGH;
    }
    if (s.includes('moderate')) {
      return InteractionSeverity.MODERATE;
    }
    return InteractionSeverity.LOW;
  }
}
