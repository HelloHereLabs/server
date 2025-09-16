import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { LogService } from './log.service';
import { CreateChatLogDto } from '../../entities/log.entity';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('로그')
@ApiBearerAuth('access-token')
@Controller('logs')
@UseGuards(AuthGuard)
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Post()
  @ApiOperation({ summary: '채팅 로그 생성', description: '새로운 채팅 로그를 생성합니다' })
  @ApiResponse({ status: 201, description: '로그 생성 성공' })
  async createLog(@Body() createLogDto: CreateChatLogDto) {
    return this.logService.createChatLog(createLogDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: '사용자 로그 조회', description: '특정 사용자의 채팅 로그를 조회합니다' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 로그 조회 성공' })
  async getUserLogs(@Param('userId') userId: string) {
    return this.logService.getUserLogs(userId);
  }

  @Get('room/:roomId')
  @ApiOperation({ summary: '채팅방 로그 조회', description: '특정 채팅방의 로그를 조회합니다' })
  @ApiParam({ name: 'roomId', description: '채팅방 ID' })
  @ApiResponse({ status: 200, description: '채팅방 로그 조회 성공' })
  async getRoomLogs(@Param('roomId') roomId: string) {
    return this.logService.getRoomLogs(roomId);
  }

  @Get('unsafe')
  @ApiOperation({ summary: '위험 메시지 조회', description: '유해한 내용이 포함된 메시지들을 조회합니다' })
  @ApiResponse({ status: 200, description: '위험 메시지 조회 성공' })
  async getUnsafeLogs() {
    return this.logService.getUnsafeLogs();
  }

  @Get('risk-level/:level')
  @ApiOperation({ summary: '위험도별 로그 조회', description: '특정 위험도의 로그를 조회합니다' })
  @ApiParam({ 
    name: 'level', 
    description: '위험도', 
    enum: ['low', 'medium', 'high'],
    example: 'high'
  })
  @ApiResponse({ status: 200, description: '위험도별 로그 조회 성공' })
  async getLogsByRiskLevel(@Param('level') level: 'low' | 'medium' | 'high') {
    return this.logService.getLogsByRiskLevel(level);
  }

  @Get('stats')
  @ApiOperation({ summary: '로그 통계', description: '전체 로그 통계를 조회합니다' })
  @ApiResponse({ 
    status: 200, 
    description: '로그 통계 조회 성공',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: '전체 로그 수' },
        safe: { type: 'number', description: '안전한 로그 수' },
        unsafe: { type: 'number', description: '위험한 로그 수' },
        riskLevels: {
          type: 'object',
          properties: {
            low: { type: 'number' },
            medium: { type: 'number' },
            high: { type: 'number' }
          }
        }
      }
    }
  })
  async getLogStats() {
    return this.logService.getLogStats();
  }

  @Delete(':id')
  @ApiOperation({ summary: '로그 삭제', description: '특정 로그를 삭제합니다' })
  @ApiParam({ name: 'id', description: '로그 ID' })
  @ApiResponse({ status: 200, description: '로그 삭제 성공' })
  async deleteLog(@Param('id') id: string) {
    const deleted = await this.logService.deleteLog(id);
    return { success: deleted };
  }
}