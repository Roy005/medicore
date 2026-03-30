import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { AuditLog, AccessToken } from '../entities';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorProfile, AuditLog, AccessToken]),
    AuthModule,
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule {}
