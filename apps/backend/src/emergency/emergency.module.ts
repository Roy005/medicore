import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyService } from './emergency.service';
import { EmergencyController } from './emergency.controller';
import { AuthModule } from '../auth/auth.module';
import {
  PatientProfile,
  Medication,
  Allergy,
  AuditLog,
  AccessToken,
} from '../entities';
import { Vital } from '../entities/vital.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientProfile,
      Medication,
      Allergy,
      AuditLog,
      AccessToken,
      Vital,
    ]),
    AuthModule,
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
