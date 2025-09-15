import { Controller, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('start')
  @ApiOperation({ summary: '세션 시작', description: '3일 유효기간 토큰을 생성하여 쿠키로 설정합니다' })
  @ApiResponse({
    status: 201,
    description: '토큰 생성 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '성공 메시지' },
        expiresAt: { type: 'number', description: '만료 시각 (timestamp)' }
      }
    }
  })
  async startSession(@Res() res: Response) {
    const { token, expiresAt } = await this.authService.startSession();

    const cookieMaxAgeDays = parseInt(process.env.COOKIE_MAX_AGE_DAYS || '3');

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAgeDays * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: '토큰이 쿠키로 설정되었습니다',
      expiresAt
    });
  }
}