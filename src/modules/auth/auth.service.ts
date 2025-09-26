import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User, CreateUserDto } from '../../entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly tokenExpiry = '3d';

  constructor(private readonly userService: UserService) {}

  generateRandomNickname(): string {
    const adjectives = [
      'Happy', 'Bright', 'Clever', 'Swift', 'Gentle', 'Bold', 'Calm', 'Cheerful',
      'Cool', 'Friendly', 'Lucky', 'Smart', 'Brave', 'Kind', 'Sunny', 'Funny',
      'Strong', 'Quick', 'Quiet', 'Loud', 'Wild', 'Cute', 'Fierce', 'Wise'
    ];

    const animals = [
      'Cat', 'Dog', 'Fox', 'Bear', 'Lion', 'Tiger', 'Rabbit', 'Panda',
      'Wolf', 'Eagle', 'Deer', 'Owl', 'Whale', 'Dolphin', 'Penguin', 'Shark',
      'Horse', 'Mouse', 'Bird', 'Fish', 'Snake', 'Frog', 'Turtle', 'Monkey', 'Elephant'
    ];

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    const randomNumber = Math.floor(Math.random() * 10) + 1; // 1~10

    return `${randomAdjective}${randomAnimal}${randomNumber}`;
  }

  generateToken(user: User): string {
    const payload = {
      userId: user.userId,
      nickname: user.nickname,
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
      nickname: this.generateRandomNickname(),
      language: 'Korean',
      interests: [],
      purpose: 'Travel Companion',
      location: { latitude: 0, longitude: 0 },
    };

    const { token, expiresAt } = await this.createUserAndToken(defaultUserData);
    return { token, expiresAt };
  }

  async generateWebSocketToken(userId: string): Promise<{ token: string; expiresAt: number }> {
    const user = await this.userService.findUserById(userId);
    const payload = {
      userId: user.userId,
      nickname: user.nickname,
      language: user.language,
      purpose: user.purpose,
      type: 'websocket',
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '3d' });
    const expiresAt = Date.now() + (3 * 24 * 60 * 60 * 1000); // 3일

    return { token, expiresAt };
  }
}