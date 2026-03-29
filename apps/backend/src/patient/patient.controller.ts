import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PatientService } from './patient.service';
import {
  UpdateProfileDto,
  CreateMedicationDto,
  CreateAllergyDto,
} from './patient.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // Must be above ':id/profile' to avoid being caught by param route
  @Get('me/profile')
  getMyProfile(@Request() req: ExpressRequest & { user: any }) {
    return this.patientService.getProfileByUserId(req.user.userId);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Request() req: ExpressRequest & { user: any }) {
    return this.patientService.getProfile(id, req.user);
  }

  @Patch(':id/profile')
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.patientService.updateProfile(id, dto, req.user);
  }

  @Post(':id/medications')
  addMedication(
    @Param('id') id: string,
    @Body() dto: CreateMedicationDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.patientService.addMedication(id, dto, req.user);
  }

  @Get(':id/medications')
  getMedications(@Param('id') id: string, @Request() req: ExpressRequest & { user: any }) {
    return this.patientService.getMedications(id, req.user);
  }

  @Post(':id/allergies')
  addAllergy(
    @Param('id') id: string,
    @Body() dto: CreateAllergyDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.patientService.addAllergy(id, dto, req.user);
  }

  @Get(':id/allergies')
  getAllergies(@Param('id') id: string, @Request() req: ExpressRequest & { user: any }) {
    return this.patientService.getAllergies(id, req.user);
  }
}
