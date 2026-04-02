import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import dotenv from 'dotenv';
import { join } from 'path';

type ResolveEnvFilePathInput = {
  nodeEnv?: string;
  dotenvConfigPath?: string;
};

let loaded = false;

export function resolveEnvFilePath(input: ResolveEnvFilePathInput = {}) {
  const explicitPath = input.dotenvConfigPath?.trim();
  if (explicitPath) return explicitPath;

  const nodeEnv = (input.nodeEnv ?? '').trim().toLowerCase();
  return nodeEnv === 'production' ? '.env.production' : '.env.local';
}

export function loadEnv(input: ResolveEnvFilePathInput = {}) {
  const path = resolveEnvFilePath({
    nodeEnv: input.nodeEnv ?? process.env.NODE_ENV,
    dotenvConfigPath: input.dotenvConfigPath ?? process.env.DOTENV_CONFIG_PATH,
  });

  if (!loaded) {
    dotenv.config({ path });
    loaded = true;
  }

  return path;
}

function readPort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback = false) {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === 'true';
}

export function buildDatabaseConfig(env: NodeJS.ProcessEnv = process.env): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST?.trim() || '127.0.0.1',
    port: readPort(env.DB_PORT, 3306),
    username: env.DB_USER?.trim() || 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME?.trim() || 'flightdb',
    entities: [join(__dirname, '..', '**/*.schema{.ts,.js}')],
    synchronize: readBoolean(env.DB_SYNCHRONIZE, false),
  };
}
