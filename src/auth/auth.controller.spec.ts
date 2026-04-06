import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

describe('AuthController service contract', () => {
  let controller: AuthController;
  let userService: jest.Mocked<UserService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    process.env.BFF_SERVICE_TOKEN = 'bff-secret';

    userService = {
      create: jest.fn(),
      findById: jest.fn(),
      validateUser: jest.fn(),
      findByEmail: jest.fn(),
      changePassword: jest.fn(),
    } as any;

    authService = {
      validateUser: jest.fn(),
      issueTokens: jest.fn(),
      refreshTokens: jest.fn(),
      readProfile: jest.fn(),
      registerUser: jest.fn(),
      loginWithGoogleCredential: jest.fn(),
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

  it('rejects login without matching service token', async () => {
    authService.validateUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as any);

    const req: any = { header: jest.fn().mockReturnValue('') };
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() };

    await expect(
      controller.login({ email: 'a@b.com', password: 'pw' }, req, res),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns token pair from auth service login without browser cookie handling', async () => {
    authService.validateUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as any);
    authService.issueTokens.mockReturnValue({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    const req: any = { header: jest.fn().mockReturnValue('bff-secret') };
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() };
    const out = await controller.login({ email: 'a@b.com', password: 'pw' }, req, res);

    expect(out).toEqual({
      id: 'u1',
      email: 'a@b.com',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
