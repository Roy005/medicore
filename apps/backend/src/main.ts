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

  // Ensure database schema is up-to-date (idempotent migration checks)
  try {
    const ds = app.get(DataSource);
    // V6: Consent system enum values
    await ds.query(`ALTER TABLE access_tokens ALTER COLUMN granted_to_user_id DROP NOT NULL`).catch(() => {});
    await ds.query(`ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_read'`).catch(() => {});
    await ds.query(`ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_write'`).catch(() => {});
    // V9: Store document file data in database (for ephemeral filesystems)
    await ds.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA`).catch(() => {});
    logger.log('✅ Database schema verified');
  } catch (err) {
    logger.warn('⚠️ Could not verify database schema: ' + (err as Error).message);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`🚀 MediCore API running on http://localhost:${port}/api/v1`);
}

void bootstrap();

