# Notes Backend (Entities + Minimal REST) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add backend support for Notes: nested categories + richtext notes (Lexical JSON), scoped per-user.

**Architecture:** Add a new `note` Nest module with two TypeORM entities (`NoteCategory`, `Note`) plus a minimal REST controller protected by `AuthGuard`. Persist data via TypeORM repositories. This repo currently uses `synchronize: true`, so tables will be created automatically in dev.

**Tech Stack:** NestJS, TypeORM, MySQL, Jest.

---

### Task 1: Add TypeORM entities

**Files:**
- Create: `src/note/schemas/noteCategory.schema.ts`
- Create: `src/note/schemas/note.schema.ts`

**Step 1: Implement `NoteCategory`**
- uuid PK, `userId`, `name`, nullable `parentId`, `sortOrder`, `createdAt`, `updatedAt`
- indexes + unique constraint on (`userId`,`parentId`,`name`)

**Step 2: Implement `Note`**
- uuid PK, `userId`, `categoryId`, `title`, `content` (longtext), `contentFormat`, `createdAt`, `updatedAt`
- indexes on (`userId`,`categoryId`,`updatedAt`) and (`userId`,`createdAt`)

---

### Task 2: Add note module wiring

**Files:**
- Create: `src/note/note.module.ts`
- Modify: `src/app.module.ts`

**Step 1: Register entities**
- `TypeOrmModule.forFeature([NoteCategory, Note])`
- Import `NoteModule` in `AppModule`

---

### Task 3: Implement minimal service + controller

**Files:**
- Create: `src/note/note.service.ts`
- Create: `src/note/note.controller.ts`
- Create: `src/note/dto/note.dto.ts`

**Endpoints (initial)**
- `GET /note/categories` → list categories for user (flat list)
- `POST /note/categories` → create category (`name`, optional `parentId`)
- `GET /note` → list notes by optional `categoryId` (default newest first)
- `POST /note` → create note (`categoryId`, `title`, `content`, optional `contentFormat`)
- `PATCH /note/:id` → update note (`title?`, `content?`, `categoryId?`)

**Validation**
- Mirror existing controllers: manual `BadRequestException` checks (no class-validator).

---

### Task 4: Add unit tests

**Files:**
- Create: `src/note/note.service.spec.ts`

**Step 1: Test basic behaviors**
- Creating category attaches `userId`
- Creating note enforces ownership + attaches `userId`
- Updating note rejects cross-user access

**Step 2: Run tests**
- Run: `npm test`
- Expected: PASS

