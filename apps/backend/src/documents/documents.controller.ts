import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') patientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest & { user: any },
  ) {
    if (!file) {
      throw new BadRequestException('File is required, and must be either PDF, JPEG, or PNG, and under 10MB.');
    }
    return this.documentsService.processUpload(patientId, file, req.user);
  }

  @Get(':id/documents')
  async listDocuments(
    @Param('id') patientId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.documentsService.listDocuments(patientId, req.user);
  }

  @Get(':id/documents/:docId')
  async getDocument(
    @Param('id') patientId: string,
    @Param('docId') docId: string,
    @Request() req: ExpressRequest & { user: any },
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const document = await this.documentsService.getDocument(docId, patientId, req.user);
    const file = createReadStream(join(process.cwd(), 'uploads', patientId, document.filename));
    
    res.set({
      'Content-Type': document.mimetype,
      'Content-Disposition': `inline; filename="${document.original_name}"`,
    });
    
    return new StreamableFile(file);
  }
}
