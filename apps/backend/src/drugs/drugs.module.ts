import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Medication, AuditLog } from '../entities';
import { DrugsController } from './drugs.controller';
import { DrugsService } from './drugs.service';
import { ConsentModule } from '../consent/consent.module';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Medication, AuditLog]),
    ConsentModule,
    AuthModule,
    RedisModule,
  ],
  controllers: [DrugsController],
  providers: [DrugsService],
  exports: [DrugsService],
})
export class DrugsModule {}
