import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DynamoDBService } from '../database/dynamodb.service';

@Injectable()
export class UserService {
  constructor(private readonly dynamoDBService: DynamoDBService) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user: User = {
      userId: uuidv4(),
      ...createUserDto,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.dynamoDBService.put(user);
    return user;
  }

  async findUserById(userId: string): Promise<User> {
    const user = await this.dynamoDBService.get(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async findUsersNearby(latitude: number, longitude: number, radiusKm: number = 10): Promise<User[]> {
    return await this.dynamoDBService.findNearbyUsers(latitude, longitude, radiusKm);
  }

  async updateUserLocation(userId: string, latitude: number, longitude: number): Promise<User> {
    const updates = {
      location: { latitude, longitude },
      updatedAt: Date.now(),
    };
    return await this.dynamoDBService.update(userId, updates);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updates = {
      ...updateUserDto,
      updatedAt: Date.now(),
    };
    return await this.dynamoDBService.update(userId, updates);
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    // 사용자 존재 확인
    await this.findUserById(userId);

    await this.dynamoDBService.delete(userId);
    return { message: `User with ID ${userId} has been deleted` };
  }

  async deactivateUser(userId: string): Promise<User> {
    const updates = {
      isActive: false,
      updatedAt: Date.now(),
    };
    return await this.dynamoDBService.update(userId, updates);
  }
}