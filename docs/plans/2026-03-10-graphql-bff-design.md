# GraphQL BFF (Code-First) — Design

**Date:** 2026-03-10

## Goal

Add a GraphQL endpoint to the existing NestJS backend as a BFF layer while keeping all existing REST endpoints unchanged. The first iteration exposes:

- `Query.profile`
- `Query.flights`

No file uploads via GraphQL in the first iteration (uploads remain REST-only).

## Scope / Non-goals (v1)

- No GraphQL mutations in v1.
- No GraphQL file upload.
- No schema federation / microservice splitting.

## GraphQL Approach

- **Code-first** schema generation (TypeScript decorators).
- Use Apollo driver (`@nestjs/apollo`).
- GraphQL endpoint path: `/graphql`.
- Enable playground in non-production environments.

## Auth / Session / JWT

GraphQL requests must share the same auth behavior as REST:

- If `AUTH_MODE=session`: rely on `express-session` + Redis store and set `req.user` from `req.session.userId`.
- If `AUTH_MODE=jwt`: rely on `Authorization: Bearer <token>` and set `req.user` from verified JWT payload.

Implementation detail:

- `GraphQLModule` context includes `{ req, res }`.
- The existing `AuthGuard` is updated to support both HTTP and GraphQL execution contexts (extracting the Express `req` appropriately).
- Resolvers use `@UseGuards(AuthGuard)` and read `req.user.id`.

## Types

- `Profile`: `{ id, email }`
- `FlightListItem`: mirrors the REST `/flight` list item shape:
  - All flight columns (strings/ints)
  - `track` (GeoJSON feature) as a JSON scalar
  - `trackSource` as `String` (currently `FORE_FLIGHT` or null)
  - `trackMeta` as JSON scalar

To avoid new dependencies, a small custom `JSON` scalar is implemented in-repo.

## Testing

- Add a small integration-style Jest test that POSTs to `/graphql` using `supertest`.
- Run in `AUTH_MODE=jwt` using an access token from existing `src/utils/jwt.ts`.
- Mock `UserService` and `FlightService` to avoid DB access.

