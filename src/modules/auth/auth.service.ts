import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User } from '../../entities/user.entity';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly tokenExpiry = '3d';

  generateToken(user: User): string {
    const payload = {
      userId: user.id,
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

  async startSession(): Promise<{ token: string; expiresAt: number }> {
    const tempUser: User = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      language: 'ko',
      interests: [],
      purpose: 'tourist',
      location: { latitude: 0, longitude: 0 },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const token = this.generateToken(tempUser);
    const expiresAt = Date.now() + (3 * 24 * 60 * 60 * 1000);

    return { token, expiresAt };
  }
}