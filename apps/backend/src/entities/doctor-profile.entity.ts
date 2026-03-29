import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
}

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  user_id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  specialty!: string;

  @Column({ name: 'registration_number', type: 'varchar', length: 100, unique: true })
  registration_number!: string;

  @Column({ name: 'hospital_affiliation', type: 'varchar', length: 255, nullable: true })
  hospital_affiliation!: string | null;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verification_status!: VerificationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
