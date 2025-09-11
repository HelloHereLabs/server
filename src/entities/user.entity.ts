export interface User {
  id: string;
  language: string;
  interests: string[];
  purpose: 'tourist' | 'local' | 'business' | 'study';
  location: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
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