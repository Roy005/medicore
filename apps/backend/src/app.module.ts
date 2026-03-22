import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PatientModule } from './patient/patient.module';
import { DocumentsModule } from './documents/documents.module';
import { EmergencyModule } from './emergency/emergency.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    PatientModule,
    DocumentsModule,
    EmergencyModule,
  ],
})
export class AppModule {}
