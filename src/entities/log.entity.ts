export interface ChatLog {
  id: string;
  userId: string;
  roomId?: string;
  originalMessage: string;
  filteredMessage: string;
  messageType: 'text' | 'voice';
  language: string;
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  blockedWords: string[];
  timestamp: number;
}

export interface CreateChatLogDto {
  userId: string;
  roomId?: string;
  originalMessage: string;
  filteredMessage: string;
  messageType: 'text' | 'voice';
  language: string;
}