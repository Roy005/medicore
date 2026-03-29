import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

export enum AlertTier {
  EMERGENCY = 'emergency',
  URGENT = 'urgent',
  SOFT = 'soft',
  NUDGE = 'nudge',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  patient_id!: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientProfile;

  @Column({ name: 'metric_type', type: 'varchar', length: 50 })
  metric_type!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value!: number;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  @Column({ type: 'enum', enum: AlertTier })
  tier!: AlertTier;

  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.ACTIVE })
  status!: AlertStatus;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'rule_id', type: 'varchar', length: 100 })
  rule_id!: string;

  @Column({ name: 'dedup_key', type: 'varchar', length: 255, nullable: true })
  dedup_key!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolved_by!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolved_at!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
