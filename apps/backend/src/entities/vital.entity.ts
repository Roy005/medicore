import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('vitals')
export class Vital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  recorded_at: Date;

  @Column({ type: 'enum', enum: [
    'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'temperature', 'spo2', 'respiratory_rate', 'blood_glucose', 'weight', 'height',
  ] })
  metric_type: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_device: string;

  @Column({ type: 'text', nullable: true })
  context_notes: string;

  @Column({ type: 'boolean', default: false })
  is_anomaly_flagged: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
