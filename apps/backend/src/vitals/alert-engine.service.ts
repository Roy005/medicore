import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Alert, AlertTier, AlertStatus } from '../entities/alert.entity';

interface VitalReading {
  metricType: string;
  value: number;
  unit: string;
}

interface AlertRule {
  id: string;
  metricType: string;
  condition: (value: number) => boolean;
  tier: AlertTier;
  getMessage: (value: number, unit: string) => string;
}

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  private readonly rules: AlertRule[] = [
    // ─── EMERGENCY TIER ──────────────────────────────────
    {
      id: 'spo2_critical',
      metricType: 'spo2',
      condition: (v) => v < 90,
      tier: AlertTier.EMERGENCY,
      getMessage: (v, u) => `Critical SpO2: ${v}${u}. Immediate intervention required.`,
    },
    {
      id: 'hr_critical_high',
      metricType: 'heart_rate',
      condition: (v) => v > 150,
      tier: AlertTier.EMERGENCY,
      getMessage: (v, u) => `Critical heart rate: ${v} ${u}. Possible cardiac emergency.`,
    },
    {
      id: 'hr_critical_low',
      metricType: 'heart_rate',
      condition: (v) => v < 40,
      tier: AlertTier.EMERGENCY,
      getMessage: (v, u) => `Critical bradycardia: ${v} ${u}. Immediate attention required.`,
    },
    {
      id: 'bp_systolic_crisis',
      metricType: 'blood_pressure_systolic',
      condition: (v) => v > 180,
      tier: AlertTier.EMERGENCY,
      getMessage: (v, u) => `Hypertensive crisis: systolic ${v} ${u}. Urgent treatment needed.`,
    },
    {
      id: 'glucose_critical_low',
      metricType: 'blood_glucose',
      condition: (v) => v < 54,
      tier: AlertTier.EMERGENCY,
      getMessage: (v, u) => `Severe hypoglycemia: ${v} ${u}. Immediate glucose needed.`,
    },

    // ─── URGENT TIER ─────────────────────────────────────
    {
      id: 'spo2_low',
      metricType: 'spo2',
      condition: (v) => v >= 90 && v < 94,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `Low SpO2: ${v}${u}. Monitor closely, supplemental O2 may be needed.`,
    },
    {
      id: 'hr_high',
      metricType: 'heart_rate',
      condition: (v) => v > 120 && v <= 150,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `Elevated heart rate: ${v} ${u}. Evaluate cause.`,
    },
    {
      id: 'bp_systolic_high',
      metricType: 'blood_pressure_systolic',
      condition: (v) => v > 140 && v <= 180,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `Hypertension detected: systolic ${v} ${u}. Review medication.`,
    },
    {
      id: 'glucose_low',
      metricType: 'blood_glucose',
      condition: (v) => v >= 54 && v < 70,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `Hypoglycemia: ${v} ${u}. Treat accordingly.`,
    },
    {
      id: 'glucose_high',
      metricType: 'blood_glucose',
      condition: (v) => v > 300,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `Severe hyperglycemia: ${v} ${u}. Review insulin.`,
    },
    {
      id: 'temp_high',
      metricType: 'temperature',
      condition: (v) => v > 39.5,
      tier: AlertTier.URGENT,
      getMessage: (v, u) => `High fever: ${v}${u}. Evaluate for infection.`,
    },

    // ─── SOFT TIER ───────────────────────────────────────
    {
      id: 'bp_systolic_elevated',
      metricType: 'blood_pressure_systolic',
      condition: (v) => v > 130 && v <= 140,
      tier: AlertTier.SOFT,
      getMessage: (v, u) => `Elevated blood pressure: systolic ${v} ${u}. Monitor trend.`,
    },
    {
      id: 'glucose_elevated',
      metricType: 'blood_glucose',
      condition: (v) => v > 180 && v <= 300,
      tier: AlertTier.SOFT,
      getMessage: (v, u) => `Elevated glucose: ${v} ${u}. Consider medication adjustment.`,
    },
    {
      id: 'temp_mild_fever',
      metricType: 'temperature',
      condition: (v) => v > 37.8 && v <= 39.5,
      tier: AlertTier.SOFT,
      getMessage: (v, u) => `Mild fever: ${v}${u}. Monitor for progression.`,
    },

    // ─── NUDGE TIER ──────────────────────────────────────
    {
      id: 'hr_elevated',
      metricType: 'heart_rate',
      condition: (v) => v > 100 && v <= 120,
      tier: AlertTier.NUDGE,
      getMessage: (v, u) => `Heart rate slightly elevated: ${v} ${u}. Consider causes.`,
    },
  ];

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  /** Evaluate a batch of vitals and create alerts as needed */
  async evaluate(patientId: string, readings: VitalReading[]): Promise<Alert[]> {
    const newAlerts: Alert[] = [];

    try {
      for (const reading of readings) {
        for (const rule of this.rules) {
          if (rule.metricType !== reading.metricType) continue;
          if (!rule.condition(reading.value)) continue;

          // De-duplication: check if same alert exists within last 1 hour
          const dedupKey = `${patientId}:${rule.id}`;
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          const existing = await this.alertRepo
            .createQueryBuilder('alert')
            .where('alert.dedup_key = :dedupKey', { dedupKey })
            .andWhere('alert.created_at > :oneHourAgo', { oneHourAgo })
            .andWhere('alert.status != :resolved', { resolved: AlertStatus.RESOLVED })
            .getOne();

          if (existing) {
            this.logger.debug(`Dedup: skipping alert ${rule.id} for patient ${patientId}`);
            continue;
          }

          const alert = this.alertRepo.create({
            patient_id: patientId,
            metric_type: reading.metricType,
            value: reading.value,
            unit: reading.unit,
            tier: rule.tier,
            message: rule.getMessage(reading.value, reading.unit),
            rule_id: rule.id,
            dedup_key: dedupKey,
          });

          const saved = await this.alertRepo.save(alert);
          newAlerts.push(saved);

          this.logger.warn(
            `[ALERT:${rule.tier.toUpperCase()}] Patient ${patientId}: ${rule.getMessage(reading.value, reading.unit)}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(`Alert engine storage unavailable: ${(error as Error).message}`);
      return [];
    }

    return newAlerts;
  }

  /** Get active alerts for a patient */
  async getAlerts(patientId: string, status?: string) {
    const where: any = { patient_id: patientId };
    if (status) where.status = status;
    try {
      return this.alertRepo.find({
        where,
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      this.logger.warn(`Alerts unavailable: ${(error as Error).message}`);
      return [];
    }
  }

  /** Resolve an alert */
  async resolveAlert(alertId: string, resolvedBy: string) {
    try {
      await this.alertRepo.update(
        { id: alertId },
        {
          status: AlertStatus.RESOLVED,
          resolved_by: resolvedBy,
          resolved_at: new Date(),
        },
      );
      return this.alertRepo.findOne({ where: { id: alertId } });
    } catch (error) {
      this.logger.warn(`Resolve alert skipped: ${(error as Error).message}`);
      return null;
    }
  }
}
