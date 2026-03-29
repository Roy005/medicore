import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

export enum DiagnosisStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CHRONIC = 'chronic',
}

@Entity('diagnoses')
export class Diagnosis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  patient_id!: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientProfile;

  @Column({ type: 'uuid' })
  doctor_id!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: User;

  @Column({ name: 'icd10_code', type: 'varchar', length: 20 })
  icd10_code!: string;

  @Column({ name: 'icd10_description', type: 'varchar', length: 500 })
  icd10_description!: string;

  @Column({ name: 'diagnosis_date', type: 'date' })
  diagnosis_date!: string;

  @Column({ type: 'enum', enum: DiagnosisStatus, default: DiagnosisStatus.ACTIVE })
  status!: DiagnosisStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
