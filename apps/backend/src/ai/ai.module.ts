import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Medication, Allergy } from '../entities';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { VitalsModule } from '../vitals/vitals.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, Medication, Allergy]),
    VitalsModule,
    AuthModule,
    RedisModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
