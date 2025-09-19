export interface ChatRoomEntity {
  // Primary Key
  id: string;

  // Participants
  senderId: string;    // 채팅방 생성자 (보통 현재 사용자)
  receiverId: string;  // 채팅 상대방

  // Chat room metadata
  lastMessage?: string;
  lastMessageTimestamp?: number;
  lastActivity: number;  // 마지막 활동 timestamp (ms)

  // Status fields
  isActive?: boolean;    // 방 참여자 중 온라인 여부

  // Read status
  senderUnreadCount?: number;    // 보낸 사람의 읽지 않은 메시지 수
  receiverUnreadCount?: number;  // 받는 사람의 읽지 않은 메시지 수
  senderLastRead?: number;       // 보낸 사람의 마지막 읽은 timestamp
  receiverLastRead?: number;     // 받는 사람의 마지막 읽은 timestamp

  // Timestamps
  createdAt: number;
  updatedAt: number;     // 마지막 업데이트 시각 (timestamp)

  // Additional metadata
  metadata?: {
    aiRecommended?: boolean;     // AI 추천으로 생성된 방인지
    tags?: string[];             // 방 태그
    [key: string]: any;         // 기타 커스텀 데이터
  };
}

// DynamoDB용 생성 DTO
export interface CreateChatRoomDto {
  senderId: string;
  receiverId: string;
  metadata?: {
    aiRecommended?: boolean;
    tags?: string[];
    [key: string]: any;
  };
}

// 채팅방 업데이트 DTO
export interface UpdateChatRoomDto {
  lastMessage?: string;
  lastMessageTimestamp?: number;
  lastActivity?: number;
  isActive?: boolean;
  senderUnreadCount?: number;
  receiverUnreadCount?: number;
  senderLastRead?: number;
  receiverLastRead?: number;
  metadata?: {
    aiRecommended?: boolean;
    tags?: string[];
    [key: string]: any;
  };
}

// 채팅방 목록 조회용 필터
export interface ChatRoomFilter {
  userId: string;        // 해당 사용자가 참여한 방들
  isActive?: boolean;    // 활성 상태 필터
  limit?: number;        // 조회 개수 제한
  lastEvaluatedKey?: any; // 페이지네이션용
}