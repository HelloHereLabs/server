export interface ChatMessageEntity {
  // Primary Key
  id: string;

  // Foreign Keys
  chatroomId: string;
  senderId: string;      // 메시지를 보낸 사용자 ID

  // Message content
  message: string;
  type: 'text' | 'image' | 'system';

  // Attachments
  attachments?: string[]; // 첨부파일/이미지 URL 배열

  // Message status
  read: boolean;         // 읽음 여부 (기본값: false)

  // Safety filtering (기존 safety-filter 모듈과 연동)
  isSafe?: boolean;
  filteredMessage?: string;
  riskLevel?: string;

  // Language support
  language?: string;
  targetLanguage?: string;

  // Timestamps
  timestamp: number;     // 메시지 보낸 시간 (ms)
  readAt?: number;       // 읽은 시간 (읽었을 경우)

  // Additional metadata
  metadata?: {
    edited?: boolean;
    editedAt?: number;
    originalMessage?: string;
    [key: string]: any;
  };
}

// 메시지 생성 DTO
export interface CreateChatMessageDto {
  chatroomId: string;
  senderId: string;
  message: string;
  type?: 'text' | 'image' | 'system';
  attachments?: string[];
  language?: string;
  targetLanguage?: string;
  metadata?: {
    [key: string]: any;
  };
}

// 메시지 업데이트 DTO (주로 읽음 처리용)
export interface UpdateChatMessageDto {
  read?: boolean;
  readAt?: number;
  metadata?: {
    edited?: boolean;
    editedAt?: number;
    originalMessage?: string;
    [key: string]: any;
  };
}

// 메시지 조회 필터
export interface ChatMessageFilter {
  chatroomId: string;
  limit?: number;         // 조회할 메시지 수 (기본값: 50)
  before?: number;        // 특정 timestamp 이전 메시지들 조회
  after?: number;         // 특정 timestamp 이후 메시지들 조회
  senderId?: string;      // 특정 사용자의 메시지만 조회
  type?: 'text' | 'image' | 'system'; // 특정 타입의 메시지만 조회
  lastEvaluatedKey?: any; // 페이지네이션용
}

// 읽지 않은 메시지 카운트
export interface UnreadMessageCount {
  chatroomId: string;
  userId: string;
  count: number;
  lastChecked: number;
}