import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './schemas/user.schema';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  async create(email: string, password: string, inviteCode: string) {
    if (!inviteCode || inviteCode !== 'qwerty123') return null;
    
    const hashed = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      email: email.trim().toLowerCase(),
      password: hashed,
      inviteCode,
      registerSource: 'LOCAL',
    });
    return this.userRepo.save(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  }

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

  async createOauthUser(email: string, inviteCode = 'google') {
    const normalizedEmail = email.trim().toLowerCase();
    const secret = randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(secret, 10);
    const user = this.userRepo.create({
      email: normalizedEmail,
      password: hashed,
      inviteCode,
      registerSource: 'GOOGLE_OAUTH',
    });
    return this.userRepo.save(user);
  }
}
