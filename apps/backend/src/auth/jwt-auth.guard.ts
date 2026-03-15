import { Injectable, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Run Passport JWT validation first
    const isValid = await (super.canActivate(context) as Promise<boolean>);
    if (!isValid) {
      return false;
    }

    // Check if token is blacklisted
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const isBlacklisted = await this.redis.get(`bl:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return true;
  }
}
