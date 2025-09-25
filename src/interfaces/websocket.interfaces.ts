// WebSocket 메시지 인터페이스들

// 대화 요청 보내기 (C → S) (대화방 생성)
export interface RequestNewChat {
  action: 'requestNewChat';
  data: {
    sender: string;   // 요청 보내는 사용자 ID
    receiver: string; // 요청 받을 사용자 ID
  };
}

// 대화 요청 받기 (S → C)
export interface ReceiveNewChat {
  action: 'receiveNewChat';
  data: {
    sender: string;         // 요청 보낸 사용자 ID
    senderNickname: string; // 요청 보낸 사용자 닉네임
    chatRoomId: string;     // 새로 생성된 채팅방 ID
    receiver: string;       // 요청 받을 사용자 ID
  };
}

// 대화 요청 수락 (C → S)
export interface AcceptNewChat {
  action: 'acceptNewChat';
  data: {
    sender: string;      // 요청 보낸 사용자 ID
    receiver: string;    // 요청 받은 사용자 ID
    chatRoomId: string;  // 채팅방 ID
  };
}

// 대화 요청 거절 (C → S)
export interface RejectNewChat {
  action: 'rejectNewChat';
  data: {
    sender: string;      // 요청 보낸 사용자 ID
    receiver: string;    // 요청 받은 사용자 ID
    chatRoomId: string;  // 채팅방 ID
  };
}

// 대화 요청 수락됨 알림 (S → C)
export interface ChatAccepted {
  action: 'chatAccepted';
  data: {
    chatRoomId: string;
    receiver: string;
    receiverNickname: string;
  };
}

// 대화 요청 거절됨 알림 (S → C)
export interface ChatRejected {
  action: 'chatRejected';
  data: {
    chatRoomId: string;
    receiver: string;
    receiverNickname: string;
  };
}

// 채팅 메시지 전송 (C → S)
export interface SendMessage {
  action: 'sendMessage';
  data: {
    chatRoomId: string;
    sender: string;
    message: string;
    messageType: 'text' | 'voice';
    timestamp: number;
  };
}

// 채팅 메시지 수신 (S → C)
export interface ReceiveMessage {
  action: 'receiveMessage';
  data: {
    chatRoomId: string;
    sender: string;
    senderNickname: string;
    message: string;
    messageType: 'text' | 'voice';
    timestamp: number;
  };
}

// WebSocket 메시지 타입 유니언
export type WebSocketMessage =
  | RequestNewChat
  | ReceiveNewChat
  | AcceptNewChat
  | RejectNewChat
  | ChatAccepted
  | ChatRejected
  | SendMessage
  | ReceiveMessage;