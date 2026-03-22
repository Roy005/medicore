import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';

import {
  PatientProfile,
  Medication,
  Allergy,
  AuditLog,
  AccessToken,
} from '../entities';
import { Vital } from '../entities/vital.entity';

/** Shape of the static emergency snapshot JSON */
interface EmergencySnapshot {
  patientName: string;
  bloodGroup: string | null;
  allergies: { allergen: string; severity: string; reaction: string | null }[];
  activeMedications: { drugName: string; dosage: string | null; frequency: string | null }[];
  chronicConditions: string[];
  emergencyContacts: unknown[];
  lastVitalsSnapshot: {
    bp: string | null;
    hr: string | null;
    spo2: string | null;
    glucose: string | null;
    recordedAt: string | null;
  };
  aiWarningFlags: string[];
  generatedAt: string;
  warningMessage: string;
}

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  /** Absolute path to the frontend public/emergency directory */
  private readonly snapshotDir: string;

  constructor(
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Medication)
    private readonly medicationRepo: Repository<Medication>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(Vital)
    private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AccessToken)
    private readonly accessTokenRepo: Repository<AccessToken>,
  ) {
    // Resolve snapshot directory relative to the backend package root
    // backend is at apps/backend → frontend public is at apps/frontend/public
    this.snapshotDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'emergency');
  }

  // ─── AUTH HELPER ─────────────────────────────────────────────
  async authorizeAccess(patientId: string, user: any): Promise<void> {
    if (user.role === 'patient') {
      const profile = await this.profileRepo.findOne({ where: { user_id: user.userId } });
      if (!profile || profile.id !== patientId) {
        throw new ForbiddenException('You can only access your own profile');
      }
    } else if (user.role === 'doctor') {
      const count = await this.accessTokenRepo
        .createQueryBuilder('token')
        .where('token.patient_id = :patientId', { patientId })
        .andWhere('token.granted_to_user_id = :userId', { userId: user.userId })
        .andWhere('token.revoked_at IS NULL')
        .andWhere('(token.expires_at IS NULL OR token.expires_at > NOW())')
        .getCount();
      if (count === 0) {
        throw new ForbiddenException('You do not have a valid access token for this patient');
      }
    } else {
      throw new ForbiddenException('Role not authorized for this action');
    }
  }

  // ─── TOKEN GENERATION ───────────────────────────────────────
  /**
   * Generate a 128-character random hex token and persist it on the profile.
   * If a token already exists, return it unchanged.
   */
  async ensureToken(patientId: string): Promise<string> {
    const profile = await this.profileRepo.findOne({ where: { id: patientId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    if (profile.emergency_qr_token) {
      return profile.emergency_qr_token;
    }

    const token = crypto.randomBytes(64).toString('hex'); // 128 hex chars
    await this.profileRepo.update({ id: patientId }, { emergency_qr_token: token });
    return token;
  }

  // ─── SNAPSHOT BUILDING ──────────────────────────────────────
  private async buildSnapshot(profile: PatientProfile): Promise<EmergencySnapshot> {
    // Fetch allergies
    const allergies = await this.allergyRepo.find({ where: { patient_id: profile.id } });

    // Fetch active medications
    const medications = await this.medicationRepo.find({
      where: { patient_id: profile.id, is_active: true },
    });

    // Fetch latest vitals (one per metric type we care about)
    const latestVitals = await this.getLatestVitals(profile.id);

    // Derive patient name from user email (no first_name column yet)
    const patientName = await this.derivePatientName(profile.user_id);

    const now = new Date();
    const generatedAt = now.toISOString();

    return {
      patientName,
      bloodGroup: profile.blood_group,
      allergies: allergies.map((a) => ({
        allergen: a.allergen,
        severity: a.severity,
        reaction: a.reaction_description ?? null,
      })),
      activeMedications: medications.map((m) => ({
        drugName: m.drug_name,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
      })),
      chronicConditions: [], // Future: populated by AI/ML module
      emergencyContacts: profile.emergency_contacts ?? [],
      lastVitalsSnapshot: latestVitals,
      aiWarningFlags: [], // Future: populated by AI warning engine
      generatedAt,
      warningMessage: `This data was last updated at ${now.toLocaleString('en-US', { timeZone: 'UTC' })}`,
    };
  }

  private async getLatestVitals(patientId: string): Promise<EmergencySnapshot['lastVitalsSnapshot']> {
    const result: EmergencySnapshot['lastVitalsSnapshot'] = {
      bp: null,
      hr: null,
      spo2: null,
      glucose: null,
      recordedAt: null,
    };

    try {
      // Get latest of each relevant vital type
      const metricMap: Record<string, keyof EmergencySnapshot['lastVitalsSnapshot']> = {
        blood_pressure_systolic: 'bp',
        heart_rate: 'hr',
        spo2: 'spo2',
        blood_glucose: 'glucose',
      };

      let latestTimestamp: Date | null = null;

      for (const [metricType, key] of Object.entries(metricMap)) {
        const vital = await this.vitalRepo.findOne({
          where: { patient_id: patientId, metric_type: metricType },
          order: { recorded_at: 'DESC' },
        });
        if (vital) {
          if (key === 'bp') {
            // Also try to get diastolic for combined BP reading
            const diastolic = await this.vitalRepo.findOne({
              where: { patient_id: patientId, metric_type: 'blood_pressure_diastolic' },
              order: { recorded_at: 'DESC' },
            });
            result.bp = diastolic
              ? `${vital.value}/${diastolic.value}`
              : `${vital.value}`;
          } else {
            (result as any)[key] = `${vital.value}`;
          }
          if (!latestTimestamp || vital.recorded_at > latestTimestamp) {
            latestTimestamp = vital.recorded_at;
          }
        }
      }

      result.recordedAt = latestTimestamp?.toISOString() ?? null;
    } catch (err) {
      this.logger.warn(`Failed to fetch vitals for patient ${patientId}: ${err.message}`);
      // Return nulls — vitals are non-critical for emergency page render
    }

    return result;
  }

  private async derivePatientName(userId: string): Promise<string> {
    try {
      // Use a raw query to get the user email since User entity may not be injected
      const rows = await this.profileRepo.query(
        `SELECT email FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      if (rows.length > 0 && rows[0].email) {
        const emailPrefix = rows[0].email.split('@')[0];
        // Capitalize first letter
        return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      }
    } catch {
      // fallback
    }
    return 'Patient';
  }

  // ─── FILE WRITING ───────────────────────────────────────────
  private writeSnapshotFile(token: string, snapshot: EmergencySnapshot): void {
    // Ensure directory exists
    fs.mkdirSync(this.snapshotDir, { recursive: true });

    const filePath = path.join(this.snapshotDir, `${token}.json`);
    const tempPath = `${filePath}.tmp`;

    // Atomic write: write to temp file then rename
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);

    this.logger.log(`Emergency snapshot written: ${filePath}`);
  }

  // ─── REFRESH ORCHESTRATOR ──────────────────────────────────
  /**
   * Main entry point: ensure token, build snapshot, write file.
   * Called by controller and by auto-refresh hooks.
   */
  async refreshSnapshot(patientId: string): Promise<{ token: string; generatedAt: string }> {
    const profile = await this.profileRepo.findOne({ where: { id: patientId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const token = await this.ensureToken(patientId);
    const snapshot = await this.buildSnapshot(profile);
    this.writeSnapshotFile(token, snapshot);

    return { token, generatedAt: snapshot.generatedAt };
  }

  // ─── QR CODE GENERATION ────────────────────────────────────
  async generateQrCode(patientId: string): Promise<Buffer> {
    const profile = await this.profileRepo.findOne({ where: { id: patientId } });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const token = await this.ensureToken(patientId);
    const url = `https://medicore.app/emergency/${token}`;

    const buffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });

    return buffer;
  }

  // ─── ASYNC ACCESS LOGGING ─────────────────────────────────
  /**
   * Fire-and-forget access log for emergency page scans.
   * Never throws — errors are swallowed and logged.
   */
  async logAccess(token: string, ip: string | null, userAgent: string | null): Promise<void> {
    try {
      // Look up patient by token
      const profile = await this.profileRepo.findOne({
        where: { emergency_qr_token: token },
      });

      await this.auditRepo.save(
        this.auditRepo.create({
          event_type: 'EMERGENCY_QR_SCAN',
          actor_user_id: null, // anonymous scan
          patient_id: profile?.id ?? null,
          ip_address: ip,
          resource_type: 'emergency_snapshot',
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to log emergency access for token ${token.substring(0, 8)}...: ${err.message}`);
      // Swallow — never block the page load
    }
  }
}
