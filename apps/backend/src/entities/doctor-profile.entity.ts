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

  @Column({ name: 'full_name', type: 'varchar', length: 200, nullable: true })
  full_name!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  qualifications!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'hospital_address', type: 'text', nullable: true })
  hospital_address!: string | null;

  @Column({ name: 'hospital_phone', type: 'varchar', length: 30, nullable: true })
  hospital_phone!: string | null;

  @Column({ name: 'hospital_email', type: 'varchar', length: 320, nullable: true })
  hospital_email!: string | null;

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
