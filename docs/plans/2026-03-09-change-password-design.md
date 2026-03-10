# Change Password (Session Auth) — Design

**Date:** 2026-03-09  
**Project:** `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server`  
**Status:** Approved by user (A) on 2026-03-09

## Goal

Add an authenticated endpoint that lets a logged-in user change their password by providing:

- `oldPassword`
- `newPassword`
- `confirmNewPassword`

After a successful password change, the current session remains valid (user stays logged in).

## Non-Goals (for now)

- “Forgot password” / email reset flow
- Password complexity rules (minimum length, strength checks, etc.)
- Rate limiting / brute-force protections
- Audit logs / security notifications

## API Design

### Endpoint

- `PATCH /user/update-password`

### Auth

- Requires session auth (`SessionAuthGuard`), i.e. `req.session.userId` must exist.

### Request body

```json
{
  "oldPassword": "string",
  "newPassword": "string",
  "confirmNewPassword": "string"
}
```

Rules:
- All fields required and non-empty
- `newPassword === confirmNewPassword`

### Responses

Success:

```json
{ "ok": true }
```

Errors:
- `400 Bad Request` for:
  - missing fields / empty strings
  - `newPassword !== confirmNewPassword`
  - incorrect `oldPassword`
- `401 Unauthorized` if not logged in (guard behavior)

## Data / Storage

No schema changes. Reuse existing `User.password` column (bcrypt hash).

## Implementation Notes

### Controller responsibilities

- Read `userId` from `req.session.userId`
- Validate body shape and simple invariants
- Delegate to `UserService.changePassword(...)`
- Return `{ ok: true }`

### Service responsibilities

- Load user by `id`
- Verify `oldPassword` with `bcrypt.compare`
- Hash `newPassword` with `bcrypt.hash(password, saltRounds=10)`
- Persist updated hash

### Session behavior

- Do **not** destroy session; keep user logged in.

## Testing Strategy

- Unit tests for controller input validation (missing fields, mismatch confirm, incorrect old password)
- Unit tests for service logic (compare old password, save new hash)
