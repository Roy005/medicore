import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
} from '@nestjs/common';
import { ClinicalService } from './clinical.service';
import { CreateNoteDto, CreateDiagnosisDto } from './clinical.dto';
import { ClinicalAccessGuard } from '../consent/clinical-access.guard';

@Controller()
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  // ─── CLINICAL NOTES ───────────────────────────────────────

  /** POST /api/v1/patients/:id/notes — add SOAP note (requires clinical access) */
  @UseGuards(ClinicalAccessGuard)
  @Post('patients/:id/notes')
  async createNote(
    @Param('id') patientId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const doctorId = req.clinicalAccess?.doctorId || req.user?.userId;
    return this.clinicalService.createNote(patientId, dto, doctorId, ip);
  }

  /** GET /api/v1/patients/:id/notes — paginated notes list */
  @UseGuards(ClinicalAccessGuard)
  @Get('patients/:id/notes')
  async getNotes(
    @Param('id') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.clinicalService.getNotes(
      patientId,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  // ─── DIAGNOSES ────────────────────────────────────────────

  /** POST /api/v1/patients/:id/diagnoses — add diagnosis */
  @UseGuards(ClinicalAccessGuard)
  @Post('patients/:id/diagnoses')
  async createDiagnosis(
    @Param('id') patientId: string,
    @Body() dto: CreateDiagnosisDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const doctorId = req.clinicalAccess?.doctorId || req.user?.userId;
    return this.clinicalService.createDiagnosis(patientId, dto, doctorId, ip);
  }

  /** GET /api/v1/patients/:id/diagnoses — list diagnoses */
  @UseGuards(ClinicalAccessGuard)
  @Get('patients/:id/diagnoses')
  async getDiagnoses(@Param('id') patientId: string) {
    return this.clinicalService.getDiagnoses(patientId);
  }

  // ─── ICD-10 SEARCH ────────────────────────────────────────

  /** GET /api/v1/icd10/search?q={term} — search ICD-10 codes (no auth needed for autocomplete) */
  @Get('icd10/search')
  async searchIcd10(@Query('q') query: string) {
    return this.clinicalService.searchIcd10(query || '');
  }

  // ─── TIMELINE ─────────────────────────────────────────────

  /** GET /api/v1/patients/:id/timeline — unified chronological events */
  @UseGuards(ClinicalAccessGuard)
  @Get('patients/:id/timeline')
  async getTimeline(
    @Param('id') patientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
    @Ip() ip?: string,
  ) {
    const doctorId = req?.clinicalAccess?.doctorId || req?.user?.userId;
    return this.clinicalService.getTimeline(
      patientId,
      parseInt(page || '1', 10),
      parseInt(limit || '50', 10),
      doctorId,
      ip,
    );
  }
}
