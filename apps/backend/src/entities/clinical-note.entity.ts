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

@Entity('clinical_notes')
export class ClinicalNote {
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

  @Column({ type: 'text', nullable: true })
  subjective!: string | null;

  @Column({ type: 'text', nullable: true })
  objective!: string | null;

  @Column({ type: 'text', nullable: true })
  assessment!: string | null;

  @Column({ type: 'text', nullable: true })
  plan!: string | null;

  @Column({ type: 'date' })
  visit_date!: string;

  @Column({ name: 'amended_note_id', type: 'uuid', nullable: true })
  amended_note_id!: string | null;

  @ManyToOne(() => ClinicalNote, { nullable: true })
  @JoinColumn({ name: 'amended_note_id' })
  amended_note!: ClinicalNote | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
