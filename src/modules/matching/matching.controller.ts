import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MatchingService, MatchRequest } from './matching.service';
import { UserProfile, LocationData, UserEmbedding } from '../embeddings/embeddings.service';

@ApiTags('매칭 서비스')
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('find-matches')
  @ApiOperation({ summary: 'GPS 및 관심사 기반 매칭' })
  @ApiResponse({ status: 200, description: '매칭 결과 반환' })
  async findMatches(@Body() request: {
    userId: string;
    profile: UserProfile;
    location: LocationData;
    maxDistance?: number;
    minSimilarity?: number;
    candidateUsers: UserEmbedding[];
  }) {
    const { candidateUsers, ...matchRequest } = request;
    return this.matchingService.findMatches(matchRequest as MatchRequest, candidateUsers);
  }

  @Post('recommendations')
  @ApiOperation({ summary: '위치 기반 사용자 매칭 및 추천' })
  @ApiResponse({ status: 200, description: '위치·관심사·목적 기반 매칭된 사용자 정보 반환' })
  async getRecommendations(@Body() request: {
    userId: string;
  }) {
    return this.matchingService.getLocationBasedRecommendations(request.userId);
  }

}