import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ChatLog, CreateChatLogDto } from '../../entities/log.entity';
import { SafetyFilterService } from '../safety-filter/safety-filter.service';

@Injectable()
export class LogService {
  private logs: ChatLog[] = [];

  constructor(private readonly safetyFilterService: SafetyFilterService) {}

  async createChatLog(createLogDto: CreateChatLogDto): Promise<ChatLog> {
    const safetyResult = await this.safetyFilterService.checkMessage(createLogDto.originalMessage);
    
    const chatLog: ChatLog = {
      id: uuidv4(),
      ...createLogDto,
      isSafe: safetyResult.isSafe,
      riskLevel: safetyResult.riskLevel,
      blockedWords: safetyResult.blockedWords,
      timestamp: Date.now(),
    };

    this.logs.push(chatLog);
    return chatLog;
  }

  async getUserLogs(userId: string): Promise<ChatLog[]> {
    return this.logs
      .filter(log => log.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getRoomLogs(roomId: string): Promise<ChatLog[]> {
    return this.logs
      .filter(log => log.roomId === roomId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getUnsafeLogs(): Promise<ChatLog[]> {
    return this.logs
      .filter(log => !log.isSafe)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async getLogsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): Promise<ChatLog[]> {
    return this.logs
      .filter(log => log.riskLevel === riskLevel)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async deleteLog(logId: string): Promise<boolean> {
    const index = this.logs.findIndex(log => log.id === logId);
    if (index > -1) {
      this.logs.splice(index, 1);
      return true;
    }
    return false;
  }

  async getLogStats(): Promise<{
    total: number;
    safe: number;
    unsafe: number;
    riskLevels: {
      low: number;
      medium: number;
      high: number;
    };
  }> {
    const total = this.logs.length;
    const safe = this.logs.filter(log => log.isSafe).length;
    const unsafe = total - safe;
    
    const riskLevels = {
      low: this.logs.filter(log => log.riskLevel === 'low').length,
      medium: this.logs.filter(log => log.riskLevel === 'medium').length,
      high: this.logs.filter(log => log.riskLevel === 'high').length,
    };

    return { total, safe, unsafe, riskLevels };
  }
}