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
  @ApiOperation({ summary: '추천 사용자 목록' })
  async getRecommendations(@Body() request: {
    profile: UserProfile;
    location: LocationData;
    allUsers: UserEmbedding[];
    limit?: number;
  }) {
    return this.matchingService.getRecommendedUsers(
      request.profile,
      request.location,
      request.allUsers,
      request.limit
    );
  }

}