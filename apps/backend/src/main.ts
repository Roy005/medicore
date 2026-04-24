import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global prefix: /api/v1
  app.setGlobalPrefix('api/v1');

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS for frontend (supports comma-separated origins)
  app.enableCors({
    origin: (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map(s => s.trim()),
    credentials: true,
  });

  // Ensure consent-system enum values exist (idempotent V6 migration)
  try {
    const ds = app.get(DataSource);
    await ds.query(`ALTER TABLE access_tokens ALTER COLUMN granted_to_user_id DROP NOT NULL`).catch(() => {});
    await ds.query(`ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_read'`).catch(() => {});
    await ds.query(`ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_write'`).catch(() => {});
    logger.log('✅ Consent enum values verified');
  } catch (err) {
    logger.warn('⚠️ Could not verify consent enum values: ' + (err as Error).message);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`🚀 MediCore API running on http://localhost:${port}/api/v1`);
}

void bootstrap();

