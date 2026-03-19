import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { signRefreshToken } from '../utils/jwt';

describe('AuthController (jwt refresh)', () => {
  let controller: AuthController;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    process.env.AUTH_MODE = 'jwt';
    process.env.JWT_SECRET = 'test-jwt-secret';
    delete process.env.JWT_REFRESH_SECRET;

    userService = {
      create: jest.fn(),
      findById: jest.fn(),
      validateUser: jest.fn(),
      findByEmail: jest.fn(),
      changePassword: jest.fn(),
    } as any;

    const authService = {
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

  it('throws Unauthorized when refresh cookie is missing', async () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn(), cookie: jest.fn() };
    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns new accessToken when refresh cookie is valid', async () => {
    userService.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' } as any);
    const rt = signRefreshToken({ sub: 'u1', email: 'a@b.com' });
    const req: any = { headers: { cookie: `refreshToken=${encodeURIComponent(rt)}` } };
    const res: any = { setHeader: jest.fn(), cookie: jest.fn() };

    const out = await controller.refresh(req, res);
    expect(typeof (out as any).accessToken).toBe('string');
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });
});

