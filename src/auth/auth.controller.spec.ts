import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

describe('AuthController direct browser contract', () => {
  let controller: AuthController;
  let userService: jest.Mocked<UserService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    process.env.AUTH_MODE = 'jwt';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    userService = {
      create: jest.fn(),
      findById: jest.fn(),
      validateUser: jest.fn(),
      findByEmail: jest.fn(),
      createOauthUser: jest.fn(),
      changePassword: jest.fn(),
    } as any;

    authService = {
      validateUser: jest.fn(),
    } as any as jest.Mocked<AuthService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('returns token pair from auth service login', async () => {
    authService.validateUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as any);

    const req: any = { session: {} };
    const res: any = { cookie: jest.fn() };
    const out = await controller.login({ email: 'a@b.com', password: 'pw' }, req, res);

    expect(out).toEqual({
      id: 'u1',
      email: 'a@b.com',
      accessToken: expect.any(String),
    });
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('returns token pair from register', async () => {
    userService.create.mockResolvedValue({ id: 'u2', email: 'new@b.com' } as any);

    const req: any = { session: {} };
    const res: any = { cookie: jest.fn() };
    const out = await controller.register({ email: 'new@b.com', password: 'pw', inviteCode: 'invite' }, req, res);

    expect(out).toEqual({
      id: 'u2',
      email: 'new@b.com',
      accessToken: expect.any(String),
    });
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('throws unauthorized when jwt refresh cookie is missing', async () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn(), cookie: jest.fn() };

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
