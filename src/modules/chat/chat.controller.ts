import { Controller, Post, Get, Body, Headers, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('채팅')
@ApiBearerAuth('access-token')
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('rooms')
  @ApiOperation({ 
    summary: '채팅방 생성', 
    description: '두 사용자 간의 채팅방을 생성합니다. 이미 존재하는 경우 기존 채팅방을 반환합니다.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: '채팅방 생성 성공',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '채팅방 ID' },
        participants: { type: 'array', items: { type: 'string' }, description: '참가자 ID 목록' },
        title: { type: 'string', description: '채팅방 제목' },
        createdBy: { type: 'string', description: '생성자 ID' },
        createdAt: { type: 'number', description: '생성 시간' },
        lastActivity: { type: 'number', description: '마지막 활동 시간' }
      }
    }
  })
  async createRoom(
    @Headers('authorization') authHeader: string,
    @Body() createRoomDto: CreateRoomDto
  ) {
    const token = authHeader?.replace('Bearer ', '');
    const userId = this.extractUserIdFromToken(token);
    
    return this.chatService.createRoom(userId, createRoomDto);
  }

  @Get('rooms')
  @ApiOperation({ summary: '내 채팅방 목록 조회', description: '내가 참여한 채팅방 목록을 조회합니다' })
  @ApiResponse({ status: 200, description: '채팅방 목록 조회 성공' })
  async getUserRooms(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    const userId = this.extractUserIdFromToken(token);
    
    return this.chatService.getUserRooms(userId);
  }

  @Post('message')
  @ApiOperation({ 
    summary: '메시지 전송', 
    description: '텍스트 또는 음성 메시지를 전송합니다. 백엔드에서 유해 단어를 자동으로 차단합니다.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: '메시지 전송 성공',
    schema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: '메시지 ID' },
        originalMessage: { type: 'string', description: '원본 메시지' },
        filteredMessage: { type: 'string', description: '필터링된 메시지' },
        isSafe: { type: 'boolean', description: '안전성 여부' },
        riskLevel: { type: 'string', description: '위험도 (low/medium/high)' }
      }
    }
  })
  async sendMessage(
    @Headers('authorization') authHeader: string,
    @Body() sendMessageDto: SendMessageDto
  ) {
    const token = authHeader?.replace('Bearer ', '');
    const userId = this.extractUserIdFromToken(token);
    
    return this.chatService.sendMessage(userId, sendMessageDto);
  }

  @Get('history/:roomId')
  @ApiOperation({ summary: '채팅 기록 조회', description: '특정 채팅방의 대화 기록을 조회합니다' })
  @ApiParam({ name: 'roomId', description: '채팅방 ID', example: 'room_123' })
  @ApiResponse({ status: 200, description: '채팅 기록 조회 성공' })
  async getChatHistory(@Param('roomId') roomId: string) {
    return this.chatService.getChatHistory(roomId);
  }

  @Get('my-messages')
  @ApiOperation({ summary: '내 메시지 조회', description: '내가 보낸 메시지들을 조회합니다' })
  @ApiResponse({ status: 200, description: '메시지 조회 성공' })
  async getMyMessages(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    const userId = this.extractUserIdFromToken(token);
    
    return this.chatService.getUserMessages(userId);
  }

  private extractUserIdFromToken(token: string): string {
    return 'temp_user_id';
  }
}