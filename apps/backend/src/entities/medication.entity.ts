import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { User } from './user.entity';

@Entity('medications')
export class Medication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column()
  drug_name: string;

  @Column({ nullable: true })
  rxnorm_code: string;

  @Column({ nullable: true })
  dosage: string;

  @Column({ nullable: true })
  frequency: string;

  @Column({ type: 'uuid', nullable: true })
  prescribed_by: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prescribed_by' })
  prescriber: User;

  @Column({ type: 'date', nullable: true })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  source: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
