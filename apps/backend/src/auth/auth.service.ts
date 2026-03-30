import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';

import { User, UserRole, PatientProfile, AuditLog, Tenant, DoctorProfile } from '../entities';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RegisterDto, LoginDto, RefreshDto } from './dto';
import { RegisterDoctorDto } from '../doctor/doctor.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;
  private readonly jwtRefreshSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.bcryptRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10);
    this.jwtRefreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // ─── REGISTER ──────────────────────────────────────────────
  async register(dto: RegisterDto, ip?: string) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    // Check for existing user
    const exists = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    let tenantId = dto.tenantId;
    if (!tenantId) {
      const tenants = await this.dataSource.manager.find(Tenant, {
        order: { created_at: 'ASC' },
        take: 1,
      });
      const defaultTenant = tenants[0];
      if (!defaultTenant) {
        throw new ConflictException('No default tenant found');
      }
      tenantId = defaultTenant.id;
    }

    const resolvedTenantId = tenantId; // guaranteed string at this point

    // Use a transaction: create user + patient_profile atomically
    const result = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: normalizedEmail,
        password_hash: passwordHash,
        tenant_id: resolvedTenantId,
        role: dto.role || UserRole.PATIENT,
      });
      const savedUser = await manager.save(user);

      const profile = manager.create(PatientProfile, {
        user_id: savedUser.id,
        demographics: {
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      await manager.save(profile);

      // Audit log
      const audit = manager.create(AuditLog, {
        event_type: 'USER_REGISTERED',
        actor_user_id: savedUser.id,
        ip_address: ip ?? null,
        resource_type: 'user',
      });
      await manager.save(audit);

      return savedUser;
    });

    this.logger.log(`User registered: ${result.id}`);

    return {
      id: result.id,
      email: result.email,
      role: result.role,
      tenantId: result.tenant_id,
      createdAt: result.created_at,
    };
  }

  // ─── REGISTER DOCTOR ───────────────────────────────────────
  async registerDoctor(dto: RegisterDoctorDto, ip?: string) {
    const normalizedEmail = this.normalizeEmail(dto.email);

    // Check for existing user
    const exists = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    let tenantId = dto.tenantId;
    if (!tenantId) {
      const tenants = await this.dataSource.manager.find(Tenant, {
        order: { created_at: 'ASC' },
        take: 1,
      });
      const defaultTenant = tenants[0];
      if (!defaultTenant) {
        throw new ConflictException('No default tenant found');
      }
      tenantId = defaultTenant.id;
    }

    const resolvedTenantId = tenantId;

    // Transaction: create user + doctor_profile atomically
    const result = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: normalizedEmail,
        password_hash: passwordHash,
        tenant_id: resolvedTenantId,
        role: UserRole.DOCTOR,
      });
      const savedUser = await manager.save(user);

      const doctorProfile = manager.create(DoctorProfile, {
        user_id: savedUser.id,
        specialty: dto.specialty,
        registration_number: dto.registrationNumber,
        hospital_affiliation: dto.hospitalAffiliation || null,
      });
      await manager.save(doctorProfile);

      // Audit log
      const audit = manager.create(AuditLog, {
        event_type: 'DOCTOR_REGISTERED',
        actor_user_id: savedUser.id,
        ip_address: ip ?? null,
        resource_type: 'user',
      });
      await manager.save(audit);

      return { user: savedUser, doctorProfile };
    });

    this.logger.log(`Doctor registered: ${result.user.id}`);

    return {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      tenantId: result.user.tenant_id,
      createdAt: result.user.created_at,
      doctorProfile: {
        id: result.doctorProfile.id,
        specialty: result.doctorProfile.specialty,
        registrationNumber: result.doctorProfile.registration_number,
        hospitalAffiliation: result.doctorProfile.hospital_affiliation,
        verificationStatus: result.doctorProfile.verification_status,
      },
    };
  }

  // ─── LOGIN ─────────────────────────────────────────────────
  async login(dto: LoginDto, ip?: string) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .getOne();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      role: user.role,
      tenantId: user.tenant_id,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '24h' });
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { secret: this.jwtRefreshSecret, expiresIn: '7d' },
    );

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'USER_LOGIN',
        actor_user_id: user.id,
        ip_address: ip ?? null,
        resource_type: 'auth',
      }),
    );

    this.logger.log(`User logged in: ${user.id}`);

    return { accessToken, refreshToken };
  }

  // ─── REFRESH ───────────────────────────────────────────────
  async refresh(dto: RefreshDto) {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if refresh token has been blacklisted
    const isBlacklisted = await this.redis.get(`bl:${dto.refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: decoded.sub,
      role: decoded.role,
      tenantId: decoded.tenantId,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '24h' });

    return { accessToken };
  }

  // ─── LOGOUT ────────────────────────────────────────────────
  async logout(token: string, userId: string, ip?: string) {
    // Decode token to get expiry
    const decoded = this.jwtService.decode(token) as JwtPayload | null;
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.set(`bl:${token}`, '1', 'EX', ttl);
      }
    }

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        event_type: 'USER_LOGOUT',
        actor_user_id: userId,
        ip_address: ip ?? null,
        resource_type: 'auth',
      }),
    );

    this.logger.log(`User logged out: ${userId}`);

    return { message: 'Logged out successfully' };
  }

  // ─── ME ────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isMfaEnabled: user.is_mfa_enabled,
      createdAt: user.created_at,
    };
  }
}
