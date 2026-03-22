import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientController } from './patient.controller';
import { PatientService } from './patient.service';
import { AuditMiddleware } from './audit.middleware';
import { AuthModule } from '../auth/auth.module';
import { EmergencyModule } from '../emergency/emergency.module';
import { PatientProfile, Medication, Allergy, AccessToken, AuditLog } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([PatientProfile, Medication, Allergy, AccessToken, AuditLog]),
    AuthModule,
    EmergencyModule,
  ],
  controllers: [PatientController],
  providers: [PatientService]
})
export class PatientModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditMiddleware)
      .forRoutes(PatientController);
  }
}
