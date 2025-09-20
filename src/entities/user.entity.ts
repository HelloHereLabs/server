export interface User {
  userId: string;
  language: string;
  interests: string[];
  purpose: 'tourist' | 'local' | 'business' | 'study';
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
  language: string;
  interests: string[];
  purpose: 'tourist' | 'local' | 'business' | 'study';
  location: {
    latitude: number;
    longitude: number;
  };
}