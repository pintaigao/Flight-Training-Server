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
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    svc = moduleRef.get(UserService);
  });

  it('returns null when old password is incorrect', async () => {
    const hashed = await bcrypt.hash('old', 1);
    repo.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: hashed,
    } as any);

    const res = await svc.changePassword('u1', 'wrong', 'new');
    expect(res).toBeNull();
  });

  it('returns null when user does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    const res = await svc.changePassword('missing', 'old', 'new');
    expect(res).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('updates password hash when old password is correct', async () => {
    const hashedOld = await bcrypt.hash('old', 1);
    repo.findOne.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: hashedOld,
    } as any);
    repo.save.mockImplementation(async (u: any) => u);

    const res = await svc.changePassword('u1', 'old', 'new');
    expect(res).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);

    const savedUser = repo.save.mock.calls[0]?.[0] as any;
    expect(savedUser.password).not.toBe(hashedOld);
    await expect(bcrypt.compare('new', savedUser.password)).resolves.toBe(true);
  });
});
