export interface Match {
  id: string;
  userAId: string;
  userBId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  distance: number;
  interestScore: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMatchDto {
  userAId: string;
  userBId: string;
  distance: number;
  interestScore: number;
}