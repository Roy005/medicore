import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Cloud (Upstash) — use REDIS_URL if available
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
        }
        // Local dev — use host/port
        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', ''),
          maxRetriesPerRequest: 3,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
