import { Language, Interest, Purpose } from '../constants/app.constants';

export interface User {
  userId: string;
  nickname?: string;
  language: Language;
  interests: Interest[];
  purpose: Purpose;
  location: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  activeConnectionId?: string;
  connectedAt?: string;
  lastLocationUpdate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUserDto {
  nickname?: string;
  language: Language;
  interests: Interest[];
  purpose: Purpose;
  location: {
    latitude: number;
    longitude: number;
  };
}