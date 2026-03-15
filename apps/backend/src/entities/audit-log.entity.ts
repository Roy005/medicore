import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; // bigserial comes back as string in pg

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  event_type!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actor_user_id!: string | null;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patient_id!: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ip_address!: string | null;

  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resource_type!: string | null;

  @Column({ name: 'event_hash', type: 'varchar', length: 256, nullable: true })
  event_hash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
