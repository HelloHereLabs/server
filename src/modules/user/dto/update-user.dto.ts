import { Language, Interest, Purpose } from '../../../constants/app.constants';

export interface UpdateUserDto {
  language?: Language;
  interests?: Interest[];
  purpose?: Purpose;
  location?: {
    latitude: number;
    longitude: number;
  };
  activeConnectionId?: string | null;
  connectedAt?: string;
  lastLocationUpdate?: string;
  isActive?: boolean;
}