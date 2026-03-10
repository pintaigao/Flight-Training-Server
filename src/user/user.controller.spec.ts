import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  it('returns 400 when oldPassword missing', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(UserController);
    await expect(
      controller.updatePassword(
        { newPassword: 'new', confirmNewPassword: 'new' } as any,
        { user: { id: 'u1' } } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 400 when confirmNewPassword mismatches', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(UserController);
    await expect(
      controller.updatePassword(
        {
          oldPassword: 'old',
          newPassword: 'new',
          confirmNewPassword: 'nope',
        } as any,
        { user: { id: 'u1' } } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 400 when old password incorrect', async () => {
    const changePassword = jest.fn(async () => null);
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: { changePassword },
        },
      ],
    }).compile();

    const controller = moduleRef.get(UserController);
    await expect(
      controller.updatePassword(
        {
          oldPassword: 'old',
          newPassword: 'new',
          confirmNewPassword: 'new',
        },
        { user: { id: 'u1' } } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(changePassword).toHaveBeenCalledWith('u1', 'old', 'new');
  });

  it('returns ok when password updated', async () => {
    const changePassword = jest.fn(async () => true);
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: { changePassword },
        },
      ],
    }).compile();

    const controller = moduleRef.get(UserController);
    const res = await controller.updatePassword(
      { oldPassword: 'old', newPassword: 'new', confirmNewPassword: 'new' },
      { user: { id: 'u1' } } as any,
    );
    expect(res).toEqual({ ok: true });
    expect(changePassword).toHaveBeenCalledWith('u1', 'old', 'new');
  });
});

