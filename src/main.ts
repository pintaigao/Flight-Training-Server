import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import session from 'express-session';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));

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
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
