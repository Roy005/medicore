import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

export enum DocumentType {
  LAB_REPORT = 'lab_report',
  PRESCRIPTION = 'prescription',
  SCAN = 'scan',
  OTHER = 'other',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column()
  filename: string;

  @Column()
  original_name: string;

  @Column()
  mimetype: string;

  @Column({ type: 'bigint' })
  size_bytes: number;

  @Column({ type: 'uuid', nullable: true })
  uploaded_by: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  upload_date: Date;

  @Column({ type: 'enum', enum: DocumentType, default: DocumentType.OTHER })
  document_type: DocumentType;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
