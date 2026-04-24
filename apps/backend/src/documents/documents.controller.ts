import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
  StreamableFile,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { Readable } from 'stream';

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

    if (!document.file_data) {
      throw new NotFoundException('Document file data not available. The file may have been uploaded before database storage was enabled.');
    }

    res.set({
      'Content-Type': document.mimetype,
      'Content-Disposition': `inline; filename="${document.original_name}"`,
    });

    const stream = Readable.from(document.file_data);
    return new StreamableFile(stream);
  }

  @Delete(':id/documents/:docId')
  async deleteDocument(
    @Param('id') patientId: string,
    @Param('docId') docId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.documentsService.deleteDocument(docId, patientId, req.user);
  }
}

