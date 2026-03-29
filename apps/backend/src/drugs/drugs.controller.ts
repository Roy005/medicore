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
import { DrugsService } from './drugs.service';
import { InteractionCheckDto, CreatePrescriptionDto } from './drugs.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClinicalAccessGuard } from '../consent/clinical-access.guard';

@Controller()
export class DrugsController {
  constructor(private readonly drugsService: DrugsService) {}

  /** GET /api/v1/drugs/search?q={query} — RxNorm autocomplete */
  @UseGuards(JwtAuthGuard)
  @Get('drugs/search')
  async search(@Query('q') query: string) {
    return this.drugsService.searchDrugs(query || '');
  }

  /** POST /api/v1/drugs/interaction-check — check interactions between RxCUIs */
  @UseGuards(JwtAuthGuard)
  @Post('drugs/interaction-check')
  async checkInteractions(@Body() dto: InteractionCheckDto) {
    return this.drugsService.checkInteractions(dto.rxcuis);
  }

  /** POST /api/v1/patients/:id/prescriptions — auto-check + save */
  @UseGuards(ClinicalAccessGuard)
  @Post('patients/:id/prescriptions')
  async prescribe(
    @Param('id') patientId: string,
    @Body() dto: CreatePrescriptionDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const doctorId = req.clinicalAccess?.doctorId || req.user?.userId;
    return this.drugsService.prescribe(patientId, dto, doctorId, ip);
  }
}
