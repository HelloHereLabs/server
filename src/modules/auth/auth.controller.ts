import { Controller, Post, Body, Param, Res, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CreateUserDto } from '../../entities/user.entity';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token/:userId')
  @ApiOperation({ summary: '사용자 토큰 생성', description: '기존 사용자 ID로 토큰을 생성합니다' })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
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
  async generateToken(@Param('userId') userId: string) {
    return this.authService.generateTokenForUser(userId);
  }

  @Post('start')
  @ApiOperation({ summary: '세션 시작', description: '사용자를 생성하고 3일 유효기간 토큰을 쿠키로 설정합니다' })
  @ApiResponse({
    status: 201,
    description: '토큰 생성 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '성공 메시지' },
        user: { type: 'object', description: '생성된 사용자 정보' },
        expiresAt: { type: 'number', description: '만료 시각 (timestamp)' }
      }
    }
  })
  async startSession(@Res() res: Response) {
    const { user, token, expiresAt } = await this.authService.createUserAndToken({
      language: 'ko',
      interests: [],
      purpose: 'tourist',
      location: { latitude: 0, longitude: 0 },
    });

    const cookieMaxAgeDays = parseInt(process.env.COOKIE_MAX_AGE_DAYS || '3');

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAgeDays * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: '토큰이 쿠키로 설정되었습니다',
      user,
      expiresAt
    });
  }

  @Get('websocket-token')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'WebSocket 연결용 임시 토큰 발급',
    description: '쿠키 인증 후 WebSocket 연결용 10분 유효 토큰을 발급합니다'
  })
  @ApiResponse({
    status: 200,
    description: 'WebSocket 토큰 발급 성공',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'WebSocket용 JWT 토큰 (10분 유효)' },
        expiresAt: { type: 'number', description: '만료 시각 (timestamp)' }
      }
    }
  })
  getWebSocketToken(@Req() req: Request & { user?: { userId: string } }) {
    const userId = req.user?.userId;
    return this.authService.generateWebSocketToken(userId);
  }
}