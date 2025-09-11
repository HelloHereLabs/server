import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('start')
  @ApiOperation({ summary: '세션 시작', description: '3일 유효기간 토큰을 생성합니다' })
  @ApiResponse({ 
    status: 201, 
    description: '토큰 생성 성공',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT 토큰' },
        expiresAt: { type: 'number', description: '만료 시각 (timestamp)' }
      }
    }
  })
  async startSession() {
    return this.authService.startSession();
  }
}