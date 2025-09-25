export interface ChatRoom {
  id: string;
  participants: { sender: string; receiver: string };
  status: 'waiting' | 'accepted' | 'rejected' | 'left';
  lastMessage?: string;
  updatedAt: string;     // 마지막 업데이트 시각 (ISO string)
  lastActivity: number;  // 마지막 활동 timestamp (ms)
  isActive?: boolean;    // 방 참여자 중 온라인 여부
  unreadCount?: number;  // 읽지 않은 메시지 개수
  metadata?: Record<string, any>; // 커스텀 데이터 (AI 추천 여부, 태그 등)
}

export interface CreateChatRoomDto {
  sender: string;
  receiver: string;
  metadata?: Record<string, any>;
}

export interface UpdateChatRoomDto {
  status?: 'waiting' | 'accepted' | 'rejected' | 'left';
  lastMessage?: string;
  unreadCount?: number;
  metadata?: Record<string, any>;
}