import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import { AppModule } from './app.module';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  // 限制 Content-Type: application/json 的 body 最大 25MB
  app.use(json({ limit: '25mb' }));
  // 限制 Content-Type: application/x-www-form-urlencoded 的 body 最大 25MB（传统表单提交那种）
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  const authMode = (process.env.AUTH_MODE ?? 'session').toLowerCase();
  if (authMode === 'session') {
    // Redis (session mode only)
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();

    app.use(
      session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.SESSION_SECRET ?? 'dev-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        },
      }),
    );
  }
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
