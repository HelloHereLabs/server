import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: '메시지 내용', example: '안녕하세요!' })
  @IsString()
  message: string;

  @ApiProperty({ 
    description: '메시지 타입', 
    enum: ['text', 'voice'], 
    example: 'text' 
  })
  @IsIn(['text', 'voice'])
  type: 'text' | 'voice';

  @ApiProperty({ description: '원본 언어', example: 'ko' })
  @IsString()
  language: string;

  @ApiProperty({ 
    description: '번역 대상 언어', 
    example: 'en',
    required: false 
  })
  @IsOptional()
  @IsString()
  targetLanguage?: string;

  @ApiProperty({ 
    description: '채팅방 ID', 
    example: 'room_123',
    required: false 
  })
  @IsOptional()
  @IsString()
  roomId?: string;
}