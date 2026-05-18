import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentExtractionService } from './document-extraction.service';
import { Document } from '../entities/document.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AccessToken } from '../entities/access-token.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Document, AuditLog, PatientProfile, AccessToken]),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const patientId = req.params.id;
          const uploadPath = `./uploads/${patientId}`;
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uuid = randomUUID();
          const ext = extname(file.originalname);
          cb(null, `${uuid}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(new Error('Only PDF, JPEG, and PNG files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentExtractionService],
  exports: [DocumentExtractionService],
})
export class DocumentsModule {}
