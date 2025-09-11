import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SafetyFilterService } from '../safety-filter/safety-filter.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateRoomDto } from './dto/create-room.dto';

export interface ChatMessage {
  id: string;
  userId: string;
  roomId?: string;
  message: string;
  type: 'text' | 'voice';
  language: string;
  targetLanguage?: string;
  isSafe: boolean;
  filteredMessage?: string;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  title?: string;
  createdBy: string;
  createdAt: number;
  lastActivity: number;
}

@Injectable()
export class ChatService {
  private messages: ChatMessage[] = [];
  private rooms: ChatRoom[] = [];

  constructor(private readonly safetyFilterService: SafetyFilterService) {}

  async sendMessage(userId: string, sendMessageDto: SendMessageDto): Promise<{
    messageId: string;
    originalMessage: string;
    filteredMessage: string;
    isSafe: boolean;
    riskLevel: string;
  }> {
    const safetyResult = await this.safetyFilterService.checkMessage(sendMessageDto.message);
    
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      userId,
      roomId: sendMessageDto.roomId,
      message: sendMessageDto.message,
      type: sendMessageDto.type,
      language: sendMessageDto.language,
      targetLanguage: sendMessageDto.targetLanguage,
      isSafe: safetyResult.isSafe,
      filteredMessage: safetyResult.filteredMessage,
      timestamp: Date.now(),
    };

    this.messages.push(chatMessage);

    return {
      messageId: chatMessage.id,
      originalMessage: sendMessageDto.message,
      filteredMessage: safetyResult.filteredMessage,
      isSafe: safetyResult.isSafe,
      riskLevel: safetyResult.riskLevel,
    };
  }

  async getChatHistory(roomId: string): Promise<ChatMessage[]> {
    return this.messages
      .filter(msg => msg.roomId === roomId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getUserMessages(userId: string): Promise<ChatMessage[]> {
    return this.messages
      .filter(msg => msg.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async createRoom(userId: string, createRoomDto: CreateRoomDto): Promise<ChatRoom> {
    const roomId = uuidv4();
    const participants = [userId, createRoomDto.targetUserId];
    
    // 이미 두 사용자 간의 채팅방이 있는지 확인
    const existingRoom = this.rooms.find(room => 
      room.participants.includes(userId) && 
      room.participants.includes(createRoomDto.targetUserId)
    );
    
    if (existingRoom) {
      return existingRoom;
    }

    const newRoom: ChatRoom = {
      id: roomId,
      participants,
      title: createRoomDto.title,
      createdBy: userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.push(newRoom);
    return newRoom;
  }

  async getUserRooms(userId: string): Promise<ChatRoom[]> {
    return this.rooms
      .filter(room => room.participants.includes(userId))
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }

  async getRoomById(roomId: string): Promise<ChatRoom | null> {
    return this.rooms.find(room => room.id === roomId) || null;
  }
}