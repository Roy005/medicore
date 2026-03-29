import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto';
import { RegisterDoctorDto } from '../doctor/doctor.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    userId: string;
    role: string;
    tenantId: string;
  };
  headers: { authorization?: string };
  ip?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Post('register/doctor')
  async registerDoctor(@Body() dto: RegisterDoctorDto, @Ip() ip: string) {
    return this.authService.registerDoctor(dto, ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthenticatedRequest, @Ip() ip: string) {
    const token = req.headers.authorization?.replace('Bearer ', '') ?? '';
    return this.authService.logout(token, req.user.userId, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }
}
