import { Controller, Post, Body, Get, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SafetyFilterService } from './safety-filter.service';

@ApiTags('안전 필터 서비스')
@Controller('safety')
export class SafetyFilterController {
  constructor(private readonly safetyFilterService: SafetyFilterService) {}

  @Post('check-message')
  @ApiOperation({ summary: '메시지 안전성 검사' })
  @ApiResponse({ status: 200, description: '메시지 안전성 분석 결과 반환' })
  async checkMessage(@Body('message') message: string) {
    return await this.safetyFilterService.checkMessage(message);
  }


  @Get('blocked-words')
  @ApiOperation({ summary: '차단된 단어 목록 조회' })
  @ApiResponse({ status: 200, description: '차단된 단어 목록 반환' })
  getBlockedWords() {
    return {
      blockedWords: this.safetyFilterService.getBlockedWords()
    };
  }

  @Post('blocked-words')
  @ApiOperation({ summary: '차단 단어 추가' })
  @ApiResponse({ status: 200, description: '차단 단어 추가 완료' })
  async addBlockedWord(@Body('word') word: string) {
    await this.safetyFilterService.addBlockedWord(word);
    return { message: '차단 단어가 추가되었습니다.', word };
  }

  @Delete('blocked-words/:word')
  @ApiOperation({ summary: '차단 단어 제거' })
  @ApiResponse({ status: 200, description: '차단 단어 제거 완료' })
  async removeBlockedWord(@Param('word') word: string) {
    await this.safetyFilterService.removeBlockedWord(word);
    return { message: '차단 단어가 제거되었습니다.', word };
  }
}