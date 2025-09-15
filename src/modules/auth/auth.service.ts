import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly tokenExpiry = process.env.TOKEN_EXPIRY || '3d';

  generateToken(user: User): string {
    const payload = {
      userId: user.id,
      language: user.language,
      purpose: user.purpose,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry as jwt.SignOptions['expiresIn']
    });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async startSession(): Promise<{ token: string; expiresAt: number }> {
    const tempUser: User = {
      id: `${process.env.TEMP_USER_PREFIX || 'temp_'}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      language: process.env.DEFAULT_LANGUAGE || 'ko',
      interests: [],
      purpose: (process.env.DEFAULT_PURPOSE as any) || 'tourist',
      location: { latitude: 0, longitude: 0 },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const token = this.generateToken(tempUser);
    const cookieMaxAgeDays = parseInt(process.env.COOKIE_MAX_AGE_DAYS || '3');
    const expiresAt = Date.now() + (cookieMaxAgeDays * 24 * 60 * 60 * 1000);

    return { token, expiresAt };
  }
}