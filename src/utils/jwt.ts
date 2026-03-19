// Minimal JWT helpers (HS256) used only when AUTH_MODE=jwt.
// We intentionally `require` jsonwebtoken to avoid needing @types/jsonwebtoken.

const jwt = require('jsonwebtoken') as any;

type JwtPayload = { sub: string; email: string };

function getJwtSecret() {
  return process.env.JWT_SECRET ?? 'dev-jwt-secret';
}

function getRefreshSecret() {
  return process.env.JWT_REFRESH_SECRET ?? getJwtSecret();
}

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: '1h' });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, getRefreshSecret(), { algorithm: 'HS256', expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getRefreshSecret(), { algorithms: ['HS256'] }) as JwtPayload;
}

export function readBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}
