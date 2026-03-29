import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vital, AuditLog } from '../entities';
import { Alert } from '../entities/alert.entity';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { AlertEngineService } from './alert-engine.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vital, AuditLog, Alert]),
    AuthModule,
  ],
  controllers: [VitalsController],
  providers: [VitalsService, AlertEngineService],
  exports: [VitalsService, AlertEngineService],
})
export class VitalsModule {}
