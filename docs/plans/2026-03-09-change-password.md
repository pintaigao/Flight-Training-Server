# Change Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `PATCH /user/update-password` for session-authenticated users to change their password using `oldPassword`, `newPassword`, and `confirmNewPassword`, without logging the user out.

**Architecture:** Add a `UserController` under the existing `UserModule`. Controller validates request body and uses `UserService.changePassword(...)` to verify old password and persist a bcrypt hash of the new password. Session remains unchanged.

**Tech Stack:** NestJS, TypeORM, MySQL, `express-session`, `bcrypt`, Jest

---

### Task 1: Add ChangePassword DTO

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/dto/change-password.dto.ts`

**Step 1: Write the DTO**

Create the file with:

```ts
export class ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
```

**Step 2: (Optional) Format**

Run: `cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server && npm run format`  
Expected: Prettier rewrites or no changes.

**Step 3: Commit (optional)**

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
git add src/user/dto/change-password.dto.ts
git commit -m "feat(user): add change password dto"
```

---

### Task 2: Add UserController with PATCH /user/update-password

**Files:**
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.controller.ts`
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.module.ts`

**Step 1: Create controller skeleton (no behavior yet)**

Create:

```ts
import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/sessionAuth.guard';
import { UserService } from './user.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('user')
@UseGuards(SessionAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('password')
  async changePassword(@Body() body: ChangePasswordDto, @Req() req: Request) {
    // TODO in next steps
    return { ok: true };
  }
}
```

**Step 2: Register controller in module**

Update `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.module.ts` to include:

- `controllers: [UserController]`

Example:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './schemas/user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
```

**Step 3: Commit (optional)**

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
git add src/user/user.controller.ts src/user/user.module.ts
git commit -m "feat(user): add user controller"
```

---

### Task 3: Add UserService.changePassword (TDD-first)

**Files:**
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.service.ts`
- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.service.spec.ts` (if it doesn’t exist)

**Step 1: Write failing unit test for changePassword**

Create `user.service.spec.ts` with a repository mock pattern similar to other tests in the repo. Minimal test cases:

1) Throws/returns error when user not found  
2) Throws/returns error when `oldPassword` incorrect  
3) Updates `password` hash when correct

Suggested shape (you can refine to match your preferred style):

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './schemas/user.schema';
import { UserService } from './user.service';

describe('UserService', () => {
  let repo: jest.Mocked<Repository<User>>;
  let svc: UserService;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    svc = moduleRef.get(UserService);
  });

  it('rejects when old password is incorrect', async () => {
    const hashed = await bcrypt.hash('old', 1);
    repo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hashed } as any);
    await expect(svc.changePassword('u1', 'wrong', 'new')).rejects.toBeTruthy();
  });
});
```

**Step 2: Run the test to see it fail**

Run:

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
npm test -- user.service.spec
```

Expected: FAIL because `changePassword` doesn’t exist yet.

**Step 3: Implement minimal changePassword**

In `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.service.ts`, add:

```ts
async changePassword(id: string, oldPassword: string, newPassword: string) {
  const user = await this.findById(id);
  if (!user) return null;
  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) return null;
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await this.userRepo.save(user);
  return true;
}
```

**Step 4: Update tests to match the chosen return style**

Decide one of:
- Return `true | null` (simple)
- Or throw domain errors (more explicit)

Given the current codebase style (returning `null` for “not found/unauthorized” in services), prefer `true | null`.

Adjust tests accordingly:
- incorrect old password → returns `null`
- success → returns `true` and `repo.save` called with updated `password`

**Step 5: Run unit tests**

Run:

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
npm test -- user.service.spec
```

Expected: PASS.

**Step 6: Commit (optional)**

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
git add src/user/user.service.ts src/user/user.service.spec.ts
git commit -m "feat(user): add change password service"
```

---

### Task 4: Wire controller to service + validations

**Files:**
- Modify: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.controller.ts`

**Step 1: Add request validation in controller**

Implement:
- required, non-empty strings for `oldPassword/newPassword/confirmNewPassword`
- `newPassword === confirmNewPassword`

Suggested implementation:

```ts
import { BadRequestException } from '@nestjs/common';

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
```

Then in handler:

```ts
const userId = req.session.userId;
if (!userId) throw new BadRequestException('missing session'); // should be unreachable due to guard

const { oldPassword, newPassword, confirmNewPassword } = body ?? ({} as any);
if (!nonEmpty(oldPassword)) throw new BadRequestException('oldPassword is required');
if (!nonEmpty(newPassword)) throw new BadRequestException('newPassword is required');
if (!nonEmpty(confirmNewPassword)) throw new BadRequestException('confirmNewPassword is required');
if (newPassword !== confirmNewPassword) throw new BadRequestException('passwords do not match');

const ok = await this.userService.changePassword(userId, oldPassword, newPassword);
if (!ok) throw new BadRequestException('oldPassword is incorrect');
return { ok: true };
```

**Step 2: Add controller unit tests**

If you want to keep tests consistent with other controller tests, add:

- Create: `/Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server/src/user/user.controller.spec.ts`

Test cases:
- mismatch confirm → 400
- incorrect old password (service returns null) → 400
- success → `{ ok: true }`

Mock `UserService` just like other controller spec files do.

**Step 3: Run tests**

Run:

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
npm test
```

Expected: PASS.

**Step 4: Commit (optional)**

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
git add src/user/user.controller.ts src/user/user.controller.spec.ts
git commit -m "feat(user): add PATCH /user/update-password"
```

---

### Task 5: Manual verification (happy path)

**Files:** none

**Step 1: Start server**

Run:

```bash
cd /Users/pintaigaohe-mini/Documents/Projects/Flight-Training-Server
npm run start:dev
```

**Step 2: Register/login to get a session cookie**

Use your frontend or an HTTP client that preserves cookies.

**Step 3: Call PATCH /user/update-password**

Body:

```json
{
  "oldPassword": "your-old",
  "newPassword": "your-new",
  "confirmNewPassword": "your-new"
}
```

Expected: `200` with `{ "ok": true }`

**Step 4: Verify session still valid**

Call `GET /auth/profile` with the same cookie.  
Expected: still `200` with the user payload.
