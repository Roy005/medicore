import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

export enum AllergySeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life_threatening',
}

@Entity('allergies')
export class Allergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column()
  allergen: string;

  @Column({ nullable: true })
  allergen_type: string;

  @Column({ type: 'enum', enum: AllergySeverity, default: AllergySeverity.MODERATE })
  severity: AllergySeverity;

  @Column({ type: 'text', nullable: true })
  reaction_description: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
