import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Vital, AuditLog } from '../entities';
import { AlertEngineService } from './alert-engine.service';

interface CreateVitalDto {
  metricType: string;
  value: number;
  unit: string;
  sourceDevice?: string;
  recordedAt?: string;
}

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);

  constructor(
    @InjectRepository(Vital)
    private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly alertEngine: AlertEngineService,
  ) {}

  /** Batch insert vitals + run alert engine */
  async addVitals(
    patientId: string,
    readings: CreateVitalDto[],
    actorUserId: string,
    ip?: string,
  ) {
    const saved: Vital[] = [];

    for (const reading of readings) {
      const vital = this.vitalRepo.create({
        patient_id: patientId,
        metric_type: reading.metricType,
        value: reading.value,
        unit: reading.unit,
        source_device: reading.sourceDevice || null,
        recorded_at: reading.recordedAt ? new Date(reading.recordedAt) : new Date(),
      } as Partial<Vital>);
      const result = await this.vitalRepo.save(vital as Vital);
      saved.push(result as Vital);
    }

    // Run alert engine on the new readings
    const alerts = await this.alertEngine.evaluate(
      patientId,
      readings.map((r) => ({
        metricType: r.metricType,
        value: r.value,
        unit: r.unit,
      })),
    );

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'vitals_recorded',
        actor_user_id: actorUserId,
        patient_id: patientId,
        ip_address: ip || null,
        resource_type: 'vital',
      }),
    );

    this.logger.log(`${saved.length} vitals recorded for patient ${patientId}, ${alerts.length} alerts triggered`);

    return {
      vitals: saved,
      alerts,
      message: `${saved.length} vitals recorded${alerts.length > 0 ? `, ${alerts.length} alert(s) triggered` : ''}`,
    };
  }

  /** Get vitals with optional filtering */
  async getVitals(
    patientId: string,
    metricType?: string,
    from?: string,
    to?: string,
    limit = 100,
  ) {
    const qb = this.vitalRepo
      .createQueryBuilder('vital')
      .where('vital.patient_id = :patientId', { patientId });

    if (metricType) {
      qb.andWhere('vital.metric_type = :metricType', { metricType });
    }
    if (from) {
      qb.andWhere('vital.recorded_at >= :from', { from: new Date(from) });
    }
    if (to) {
      qb.andWhere('vital.recorded_at <= :to', { to: new Date(to) });
    }

    return qb
      .orderBy('vital.recorded_at', 'DESC')
      .take(limit)
      .getMany();
  }

  /** Get latest reading for each metric type */
  async getLatestVitals(patientId: string) {
    const metrics = ['heart_rate', 'bp_systolic', 'bp_diastolic', 'spo2', 'glucose', 'temperature', 'weight'];
    const latest: Record<string, any> = {};

    for (const metric of metrics) {
      const reading = await this.vitalRepo.findOne({
        where: { patient_id: patientId, metric_type: metric },
        order: { recorded_at: 'DESC' },
      });
      if (reading) {
        latest[metric] = {
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recorded_at,
        };
      }
    }

    return latest;
  }
}
