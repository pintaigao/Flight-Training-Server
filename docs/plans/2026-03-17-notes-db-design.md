# Notes DB Design (Categories + Richtext Notes)

**Goal:** Support a Notes feature with notebook-like categories (folders) that can be nested, and notes stored as richtext (Lexical) per-user (private).

**Stack:** NestJS + TypeORM + MySQL.

## Core Concepts

- **Category** = “notebook folder”. Categories can be nested (tree).
- **Note** belongs to exactly one category.
- **Ownership** is per-user (all rows scoped by `userId`).
- **Richtext** content is stored as a JSON string (`content`) with a format/version marker (`contentFormat`).

## Tables

### `note_categories`

- `id` (uuid, PK)
- `userId` (varchar(36), indexed)
- `name` (varchar(128), required)
- `parentId` (uuid, nullable, indexed; self-reference)
- `sortOrder` (int, default 0) — optional sibling ordering
- `createdAt` (datetime, auto)
- `updatedAt` (datetime, auto)

**Constraints / Indexes**
- UNIQUE(`userId`, `parentId`, `name`) to prevent duplicate sibling folder names (optional but recommended)
- INDEX(`userId`, `parentId`, `sortOrder`, `createdAt`)

**Tree modeling**
- Use **adjacency list** (`parentId`) for simplicity.
- If subtree queries become hot later, consider adding materialized `path` or a closure table.

### `notes`

- `id` (uuid, PK)
- `userId` (varchar(36), indexed)
- `categoryId` (uuid, indexed; references `note_categories.id`)
- `title` (varchar(280), required)
- `content` (longtext, required) — Lexical editorState JSON string
- `contentFormat` (varchar(32), default `LEXICAL_V1`)
- `createdAt` (datetime, auto)
- `updatedAt` (datetime, auto)
- optional `deletedAt` (datetime nullable) for soft-delete

**Indexes**
- INDEX(`userId`, `categoryId`, `updatedAt`)
- INDEX(`userId`, `createdAt`)

## Notes on Richtext Storage

- Store Lexical editorState as a string to avoid tight coupling to MySQL JSON behaviors and keep migrations straightforward.
- Keep a `contentFormat` marker for future editor schema changes.

