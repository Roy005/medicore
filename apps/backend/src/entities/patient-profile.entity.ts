import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('patient_profiles')
export class PatientProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  user_id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  date_of_birth!: Date | null;

  @Column({ name: 'blood_group', type: 'varchar', length: 5, nullable: true })
  blood_group!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  demographics!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '{}' })
  insurance!: Record<string, unknown>;

  @Column({ name: 'emergency_contacts', type: 'jsonb', default: '[]' })
  emergency_contacts!: unknown[];

  @Column({ name: 'emergency_qr_token', type: 'varchar', length: 128, nullable: true })
  emergency_qr_token!: string | null;

  @Column({ name: 'profile_completeness_score', type: 'int', default: 0 })
  profile_completeness_score!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
