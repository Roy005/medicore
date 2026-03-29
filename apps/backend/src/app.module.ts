import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PatientModule } from './patient/patient.module';
import { DocumentsModule } from './documents/documents.module';
import { EmergencyModule } from './emergency/emergency.module';
import { DoctorModule } from './doctor/doctor.module';
import { ConsentModule } from './consent/consent.module';
import { ClinicalModule } from './clinical/clinical.module';
import { DrugsModule } from './drugs/drugs.module';
import { VitalsModule } from './vitals/vitals.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    PatientModule,
    DocumentsModule,
    EmergencyModule,
    DoctorModule,
    ConsentModule,
    ClinicalModule,
    DrugsModule,
    VitalsModule,
    AiModule,
  ],
})
export class AppModule {}
