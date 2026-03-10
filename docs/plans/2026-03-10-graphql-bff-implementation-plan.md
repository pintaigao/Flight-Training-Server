# GraphQL BFF (Code-First) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `/graphql` to the existing NestJS backend, exposing `profile` and `flights` queries, reusing the existing session/JWT auth behavior.

**Architecture:** Add a `GraphqlBffModule` that configures `GraphQLModule` (Apollo, code-first, `/graphql`) and provides resolvers. Update `AuthGuard` to work for GraphQL contexts by extracting the Express request from either HTTP or GraphQL execution contexts. Add a JSON scalar for `track/trackMeta`. Add a small integration test that posts to `/graphql` with JWT auth and mocked services.

**Tech Stack:** NestJS, @nestjs/graphql + @nestjs/apollo, Jest + supertest.

---

### Task 1: Add GraphQL dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Install deps**

Run: `npm i @nestjs/graphql @nestjs/apollo graphql`

Expected: `package.json` and `package-lock.json` updated.

**Step 2: Commit**

Run:
- `git add package.json package-lock.json`
- `git commit -m "chore: add graphql dependencies"`

---

### Task 2: Add GraphQL module wiring

**Files:**
- Create: `src/graphql/graphql.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Add `GraphqlBffModule`**

Create a module that imports `GraphQLModule.forRoot` using Apollo driver:
- `path: '/graphql'`
- `autoSchemaFile: true`
- `playground: process.env.NODE_ENV !== 'production'`
- `context: ({ req, res }) => ({ req, res })`

**Step 2: Add it to `AppModule` imports**

Import `GraphqlBffModule` and add to the `imports: []` list.

**Step 3: Commit**

Run:
- `git add src/graphql/graphql.module.ts src/app.module.ts`
- `git commit -m "feat: add graphql module"`

---

### Task 3: Add GraphQL types + JSON scalar (code-first)

**Files:**
- Create: `src/graphql/scalars/json.scalar.ts`
- Create: `src/graphql/types/profile.type.ts`
- Create: `src/graphql/types/flight.type.ts`

**Step 1: Add a `JSON` scalar**

Implement a minimal scalar backed by `GraphQLScalarType` that accepts object/array/primitive JSON values.

**Step 2: Add `@ObjectType()` classes**

- `ProfileType`: `id`, `email`
- `FlightListItemType`: matches REST flight list item (flight columns + `track`, `trackSource`, `trackMeta`)

**Step 3: Register providers**

Export/Provide these from `GraphqlBffModule`.

**Step 4: Commit**

Run:
- `git add src/graphql/scalars/json.scalar.ts src/graphql/types/profile.type.ts src/graphql/types/flight.type.ts`
- `git commit -m "feat: add graphql types"`

---

### Task 4: Make AuthGuard work for GraphQL

**Files:**
- Modify: `src/auth/auth.guard.ts`

**Step 1: Update request extraction**

Update the guard to get the Express `req` from:
- HTTP: `context.switchToHttp().getRequest()`
- GraphQL: `GqlExecutionContext.create(context).getContext().req`

**Step 2: Add a unit-ish test (optional)**

If useful, add a small test for request extraction; otherwise the integration test in Task 6 covers it.

**Step 3: Commit**

Run:
- `git add src/auth/auth.guard.ts`
- `git commit -m "refactor: auth guard supports graphql"`

---

### Task 5: Add resolvers (profile + flights)

**Files:**
- Create: `src/graphql/resolvers/profile.resolver.ts`
- Create: `src/graphql/resolvers/flights.resolver.ts`
- Modify: `src/graphql/graphql.module.ts`

**Step 1: Implement `ProfileResolver`**

`@Query(() => ProfileType)` → loads user by `req.user.id` and returns `{ id, email }`.

**Step 2: Implement `FlightsResolver`**

`@Query(() => [FlightListItemType])` → calls `flightService.findAllWithBestTrack(userId)` and returns the list.

**Step 3: Apply `@UseGuards(AuthGuard)`**

Guard both resolvers (class-level is fine).

**Step 4: Commit**

Run:
- `git add src/graphql/resolvers/profile.resolver.ts src/graphql/resolvers/flights.resolver.ts src/graphql/graphql.module.ts`
- `git commit -m "feat: graphql profile and flights queries"`

---

### Task 6: Add GraphQL integration test

**Files:**
- Create: `src/graphql/graphql.spec.ts`

**Step 1: Build a test-only Nest app**

- Import `GraphqlBffModule`
- Provide `AuthGuard` (real)
- Provide mocked `UserService` + mocked `FlightService`

**Step 2: Exercise `/graphql` via supertest**

- Set `process.env.AUTH_MODE='jwt'`
- Create a token with `signAccessToken`
- Query `profile` and `flights` and assert response data shape

**Step 3: Run tests**

Run: `npm test`

Expected: PASS.

**Step 4: Commit**

Run:
- `git add src/graphql/graphql.spec.ts`
- `git commit -m "test: add graphql bff coverage"`

