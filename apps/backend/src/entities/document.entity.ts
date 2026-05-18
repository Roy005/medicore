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

  @Column({ type: 'varchar', length: 50, default: DocumentType.OTHER })
  document_type: DocumentType;

  /** Binary file content stored in the database (for cloud deployments with ephemeral filesystems) */
  @Column({ type: 'bytea', nullable: true })
  file_data: Buffer | null;

  /** Extracted text content from the document (via pdf-parse or OCR) */
  @Column({ type: 'text', nullable: true })
  extracted_text: string | null;

  /** Status of text extraction: pending, completed, or failed */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  extraction_status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
