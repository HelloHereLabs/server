export interface UpdateUserDto {
  language?: string;
  interests?: string[];
  purpose?: 'tourist' | 'local' | 'business' | 'study';
  location?: {
    latitude: number;
    longitude: number;
  };
  activeConnectionId?: string | null;
  connectedAt?: string;
  lastLocationUpdate?: string;
}