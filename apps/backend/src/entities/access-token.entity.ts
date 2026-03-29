import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

export enum AccessType {
  EMERGENCY = 'emergency',
  READ_ONLY = 'read_only',
  FULL = 'full',
  CLINICAL_READ = 'clinical_read',
  CLINICAL_WRITE = 'clinical_write',
}

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column({ type: 'uuid', nullable: true })
  granted_to_user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'granted_to_user_id' })
  granted_to_user: User;

  @Column()
  token_hash: string;

  @Column({ type: 'enum', enum: AccessType, default: AccessType.READ_ONLY })
  access_type: AccessType;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  granted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date;
}

