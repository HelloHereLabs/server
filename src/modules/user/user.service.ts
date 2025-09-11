import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  private users: User[] = [];

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user: User = {
      id: uuidv4(),
      ...createUserDto,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.users.push(user);
    return user;
  }

  async findUserById(id: string): Promise<User> {
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findUsersNearby(latitude: number, longitude: number, radiusKm: number = 10): Promise<User[]> {
    return this.users.filter(user => {
      if (!user.isActive) return false;
      
      const distance = this.calculateDistance(
        latitude, longitude,
        user.location.latitude, user.location.longitude
      );
      
      return distance <= radiusKm;
    });
  }

  async updateUserLocation(id: string, latitude: number, longitude: number): Promise<User> {
    const user = await this.findUserById(id);
    user.location = { latitude, longitude };
    user.updatedAt = Date.now();
    return user;
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.findUserById(id);
    user.isActive = false;
    user.updatedAt = Date.now();
    return user;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}