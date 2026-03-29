import {
  Injectable,
  Logger,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';

import { AuditLog, Medication, Allergy } from '../entities';
import { REDIS_CLIENT } from '../redis/redis.module';
import { VitalsService } from '../vitals/vitals.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    private readonly vitalsService: VitalsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** POST /ai/advisor/chat — mock AI chat with patient context */
  async chat(
    patientId: string,
    message: string,
    doctorId: string,
    ip?: string,
  ) {
    // Gather patient context
    const [medications, allergies, latestVitals] = await Promise.all([
      this.medicationRepo.find({
        where: { patient_id: patientId, is_active: true },
      }),
      this.allergyRepo.find({ where: { patient_id: patientId } }),
      this.vitalsService.getLatestVitals(patientId),
    ]);

    const medList = medications.map((m) => m.drug_name).join(', ') || 'None';
    const allergyList = allergies.map((a) => a.allergen).join(', ') || 'None';

    // Simulate AI response using patient context
    const aiResponse = this.generateMockChatResponse(message, medList, allergyList, latestVitals);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'ai_chat',
        actor_user_id: doctorId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'ai_advisor',
      }),
    );

    return {
      response: aiResponse.text,
      safetyFlags: aiResponse.safetyFlags,
      context: {
        activeMedications: medList,
        knownAllergies: allergyList,
      },
    };
  }

  /** GET /patients/:id/ai/risk-scores — mock risk assessment */
  async getRiskScores(patientId: string, doctorId: string) {
    const cacheKey = `ai:risk:${patientId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const latestVitals = await this.vitalsService.getLatestVitals(patientId);
    const medications = await this.medicationRepo.find({
      where: { patient_id: patientId, is_active: true },
    });

    // Mock risk score calculation
    let cardiovascularRisk = 15;
    let diabetesRisk = 10;

    if (latestVitals.bp_systolic?.value > 140) cardiovascularRisk += 25;
    if (latestVitals.heart_rate?.value > 100) cardiovascularRisk += 10;
    if (latestVitals.glucose?.value > 200) diabetesRisk += 35;
    if (medications.some((m) => m.drug_name.toLowerCase().includes('metformin'))) diabetesRisk += 20;
    if (medications.some((m) => m.drug_name.toLowerCase().includes('statin'))) cardiovascularRisk += 15;

    const result = {
      cardiovascular: {
        score: Math.min(cardiovascularRisk, 95),
        level: cardiovascularRisk > 50 ? 'high' : cardiovascularRisk > 25 ? 'moderate' : 'low',
        factors: ['Blood pressure trend', 'Medication profile', 'Heart rate variability'],
      },
      type2Diabetes: {
        score: Math.min(diabetesRisk, 95),
        level: diabetesRisk > 50 ? 'high' : diabetesRisk > 25 ? 'moderate' : 'low',
        factors: ['Glucose levels', 'Medication profile', 'BMI trend'],
      },
      lastUpdated: new Date().toISOString(),
      disclaimer: 'AI-generated risk assessment. Not a clinical diagnosis. Always verify with clinical judgment.',
    };

    await this.redis.setex(cacheKey, 3600, JSON.stringify(result));

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'ai_risk_score',
        actor_user_id: doctorId,
        patient_id: patientId,
        resource_type: 'ai_risk',
      }),
    );

    return result;
  }

  /** GET /patients/:id/ai/alerts — combine rule-based + mock AI flags */
  async getAiAlerts(patientId: string) {
    const latestVitals = await this.vitalsService.getLatestVitals(patientId);
    const flags: string[] = [];

    if (latestVitals.glucose?.value > 200) {
      flags.push('Persistent hyperglycemia detected — consider HbA1c test');
    }
    if (latestVitals.bp_systolic?.value > 140) {
      flags.push('Sustained hypertension — review antihypertensive regimen');
    }
    if (latestVitals.spo2?.value && latestVitals.spo2.value < 95) {
      flags.push('Declining SpO2 trend — pulmonary evaluation recommended');
    }

    // Always add a generic mock flag for demo
    if (flags.length === 0) {
      flags.push('No immediate AI-flagged concerns. Continue monitoring.');
    }

    return {
      flags,
      generatedAt: new Date().toISOString(),
      disclaimer: 'AI-generated alerts. Clinical validation required.',
    };
  }

  /** POST /patients/:id/ai/preconsult-brief — mock summary */
  async getPreconsultBrief(patientId: string, doctorId: string) {
    const cacheKey = `ai:preconsult:${patientId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [medications, allergies, latestVitals] = await Promise.all([
      this.medicationRepo.find({ where: { patient_id: patientId, is_active: true } }),
      this.allergyRepo.find({ where: { patient_id: patientId } }),
      this.vitalsService.getLatestVitals(patientId),
    ]);

    const brief = {
      summary: `Patient has ${medications.length} active medication(s) and ${allergies.length} known allergy/allergies. Recent vitals are within monitoring range.`,
      keyPoints: [
        `Active medications: ${medications.map((m) => m.drug_name).join(', ') || 'None'}`,
        `Known allergies: ${allergies.map((a) => `${a.allergen} (${a.severity})`).join(', ') || 'None'}`,
        `Latest vitals summary available`,
      ],
      suggestedTopics: [
        'Review medication adherence',
        'Discuss any new symptoms',
        'Update preventive care schedule',
      ],
      generatedAt: new Date().toISOString(),
      disclaimer: 'AI-generated pre-consultation brief. Verify all data with patient.',
    };

    await this.redis.setex(cacheKey, 1800, JSON.stringify(brief)); // 30min cache

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'ai_preconsult',
        actor_user_id: doctorId,
        patient_id: patientId,
        resource_type: 'ai_preconsult',
      }),
    );

    return brief;
  }

  // ─── Mock response generator ──────────────────────────────

  private generateMockChatResponse(
    message: string,
    meds: string,
    allergies: string,
    vitals: any,
  ) {
    const lowerMsg = message.toLowerCase();
    const safetyFlags: string[] = [];
    let text: string;

    if (lowerMsg.includes('interaction') || lowerMsg.includes('combine')) {
      text = `Based on the patient's current medications (${meds}), I'd recommend checking RxNorm interaction databases. Known allergies include ${allergies}. Always verify contraindications before prescribing.`;
      safetyFlags.push('VERIFY_INTERACTIONS');
    } else if (lowerMsg.includes('vital') || lowerMsg.includes('blood pressure')) {
      const bp = vitals.bp_systolic ? `${vitals.bp_systolic.value}/${vitals.bp_diastolic?.value || '?'}` : 'unavailable';
      text = `Latest vitals show BP: ${bp}, HR: ${vitals.heart_rate?.value || 'N/A'}, SpO2: ${vitals.spo2?.value || 'N/A'}%. Current medications: ${meds}.`;
    } else if (lowerMsg.includes('allerg')) {
      text = `Known allergies for this patient: ${allergies}. Always check for cross-reactivity when prescribing new medications.`;
      safetyFlags.push('ALLERGY_CHECK_REQUIRED');
    } else {
      text = `I can help analyze this patient's data. Current medications: ${meds}. Known allergies: ${allergies}. Please ask a specific question about their treatment plan, vitals, or medication interactions.`;
    }

    return { text, safetyFlags };
  }
}
