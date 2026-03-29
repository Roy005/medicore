import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalNote } from '../entities/clinical-note.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { AuditLog, Medication, Allergy, Vital } from '../entities';
import { Document as MedicoreDocument } from '../entities';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
import { ConsentModule } from '../consent/consent.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicalNote,
      Diagnosis,
      AuditLog,
      Medication,
      Allergy,
      Vital,
      MedicoreDocument,
    ]),
    ConsentModule,
    AuthModule,
  ],
  controllers: [ClinicalController],
  providers: [ClinicalService],
  exports: [ClinicalService],
})
export class ClinicalModule {}
