import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User, CreateUserDto } from '../../entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly tokenExpiry = '3d';

  constructor(private readonly userService: UserService) {}

  generateToken(user: User): string {
    const payload = {
      userId: user.userId,
      language: user.language,
      purpose: user.purpose,
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiry });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async generateTokenForUser(userId: string): Promise<{ token: string; expiresAt: number }> {
    const user = await this.userService.findUserById(userId);
    const token = this.generateToken(user);
    const expiresAt = Date.now() + (3 * 24 * 60 * 60 * 1000);

    return { token, expiresAt };
  }

  async createUserAndToken(createUserDto: CreateUserDto): Promise<{ user: User; token: string; expiresAt: number }> {
    const user = await this.userService.createUser(createUserDto);
    const token = this.generateToken(user);
    const expiresAt = Date.now() + (3 * 24 * 60 * 60 * 1000);

    return { user, token, expiresAt };
  }

  async startSession(): Promise<{ token: string; expiresAt: number }> {
    const defaultUserData: CreateUserDto = {
      language: 'ko',
      interests: [],
      purpose: 'tourist',
      location: { latitude: 0, longitude: 0 },
    };

    const { token, expiresAt } = await this.createUserAndToken(defaultUserData);
    return { token, expiresAt };
  }

  generateWebSocketToken(userId: string): { token: string; expiresAt: number } {
    const payload = {
      userId,
      type: 'websocket',
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '10m' });
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10분

    return { token, expiresAt };
  }
}