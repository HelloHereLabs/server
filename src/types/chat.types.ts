// 공통 타입
interface ChatParticipant {
  userId: string;
  nickname?: string;
}

interface ChatRoom {
  id: string;            // 클라이언트용 ID
  chatroomId: string;    // DynamoDB 파티션 키
  participants: { sender: string; receiver: string };
  participantInfo?: { sender: ChatParticipant; receiver: ChatParticipant }; // UI 표시용
  lastMessage?: string;
  updatedAt: string;     // 마지막 업데이트 시각 (ISO string)
  lastActivity: number;  // 마지막 활동 timestamp (ms)
  isActive?: boolean;    // 방 참여자 중 온라인 여부
  unreadCount?: number;  // 읽지 않은 메시지 개수
  metadata?: Record<string, any>; // 커스텀 데이터 (AI 추천 여부, 태그 등)
}

interface ChatMessage {
  id: string;
  chatroomId: string;
  sender: string;
  senderNickname?: string; // UI 표시용
  message: string;
  timestamp: number;     // 메시지 보낸 시간 (ms)
  read?: boolean;        // 읽음 여부
  type?: 'text' | 'image' | 'system';
  attachments?: string[]; // 첨부파일/이미지 URL 배열
}

// ===============================
// 1️⃣ 채팅방 생성
// C -> S
interface CreateRoomRequest {
  action: 'createRoom';
  data: {
    sender: string;
    receiver: string;
  };
}

// S -> C
interface CreateRoomResponse {
  action: 'roomCreated';
  data: ChatRoom;
}

// ===============================
// 2️⃣ 메시지 전송 & 수신
// C -> S
interface SendChatMsgRequest {
  action: 'sendChatMsg';
  data: {
    sender: string;
    chatroomId: string;
    message: string;
    type?: 'text' | 'image' | 'system';
    attachments?: string[];
  };
}

// S -> C
interface NewMsgNotification {
  action: 'newMsg';
  data: {
    chatroomId: string;
    message: ChatMessage;
  };
}

// ===============================
// 3️⃣ 채팅 히스토리
// C -> S
interface GetChatHistoryRequest {
  action: 'getChatHistory';
  data: { chatroomId: string; limit?: number; before?: number };
}

// S -> C
interface GetChatHistoryResponse {
  action: 'chatHistory';
  data: {
    chatroomId: string;
    messages: ChatMessage[];  // 복수형으로 수정
  };
}

// ===============================
// 채팅방 나가기
// C -> S : 내가 채팅방에서 나가겠다고 요청
interface LeaveRoomRequest {
  action: 'leaveRoom';
  data: {
    chatroomId: string;
    userId: string;
  };
}

// S -> C : 요청 보낸 본인에게 응답 (성공/실패 여부)
interface LeaveRoomResponse {
  action: 'leaveRoomResponse';
  data: {
    chatroomId: string;
    success: boolean;
    message?: string; // 에러나 상태 설명
  };
}

// S -> C : 상대방에게 알림 (누가 나갔는지)
interface RoomLeftNotification {
  action: 'roomLeft';
  data: {
    chatroomId: string;
    userId: string; // 방을 나간 사람
  };
}

// ===============================
// 읽음 처리
// C -> S
interface OpenChatRoomRequest {
  action: 'openChatRoom';
  data: {
    chatroomId: string;
    userId: string;
  };
}

// S -> C
interface UpdateReadNotification {
  action: 'updateRead';
  data: {
    chatroomId: string;
    userId: string;
    lastReadTimestamp: number;
  };
}

// ===============================
// 채팅방 목록 조회
// C -> S
interface GetChatRoomsRequest {
  action: 'getChatRooms';
  data: {};
}

// S -> C
interface GetChatRoomsResponse {
  action: 'chatRoomsList';
  data: {
    rooms: ChatRoom[];
  };
}

// ===============================
// AI 추천 이벤트 (대화 없을 시 등)
// S -> C
interface SuggestTopicNotification {
  action: 'suggestTopic';
  data: {
    chatroomId: string;
    topic: string;
    suggestedBy: 'AI' | 'system';
  };
}

// 유니온 타입 정의
export type ChatWebSocketRequest =
  | CreateRoomRequest
  | SendChatMsgRequest
  | GetChatHistoryRequest
  | GetChatRoomsRequest
  | LeaveRoomRequest
  | OpenChatRoomRequest;

export type ChatWebSocketResponse =
  | CreateRoomResponse
  | NewMsgNotification
  | GetChatHistoryResponse
  | GetChatRoomsResponse
  | LeaveRoomResponse
  | RoomLeftNotification
  | UpdateReadNotification
  | SuggestTopicNotification;

// 개별 타입들도 export
export {
  ChatParticipant,
  ChatRoom,
  ChatMessage,
  CreateRoomRequest,
  CreateRoomResponse,
  SendChatMsgRequest,
  NewMsgNotification,
  GetChatHistoryRequest,
  GetChatHistoryResponse,
  GetChatRoomsRequest,
  GetChatRoomsResponse,
  LeaveRoomRequest,
  LeaveRoomResponse,
  RoomLeftNotification,
  OpenChatRoomRequest,
  UpdateReadNotification,
  SuggestTopicNotification
};