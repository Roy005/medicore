import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AccessToken, AuditLog, PatientProfile } from '../entities';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';
import { ClinicalAccessGuard } from './clinical-access.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessToken, AuditLog, PatientProfile]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    AuthModule,
  ],
  controllers: [ConsentController],
  providers: [ConsentService, ClinicalAccessGuard],
  exports: [ConsentService, ClinicalAccessGuard],
})
export class ConsentModule {}
