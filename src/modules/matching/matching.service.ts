import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmbeddingsService, UserProfile, LocationData, UserEmbedding } from '../embeddings/embeddings.service';

export interface MatchRequest {
  userId: string;
  profile: UserProfile;
  location: LocationData;
  maxDistance?: number;
  minSimilarity?: number;
}

export interface MatchResult {
  userId: string;
  similarity: number;
  distance: number;
  location: LocationData;
  score: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly bedrock: BedrockService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async findMatches(
    request: MatchRequest,
    candidateUsers: UserEmbedding[],
  ): Promise<MatchResult[]> {
    const maxDistance = request.maxDistance || 10;

    // GPS 기반 거리 계산만 수행
    const nearbyUsers = candidateUsers
      .filter(user => user.userId !== request.userId)
      .map(user => {
        const distance = this.embeddings.calculateDistance(request.location, user.location);
        return {
          userId: user.userId,
          similarity: 0, // GPS 매칭에서는 유사도 사용 안함
          distance,
          location: user.location,
          score: distance, // 거리가 가까울수록 높은 점수
        };
      })
      .filter(user => user.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance); // 가까운 순으로 정렬

    return nearbyUsers.slice(0, 20);
  }

  async getRecommendedUsers(
    userProfile: UserProfile,
    userLocation: LocationData,
    allUsers: UserEmbedding[],
    limit = 10
  ): Promise<MatchResult[]> {
    // AI 기반 프로필 임베딩 생성
    const targetEmbedding = await this.embeddings.generateProfileEmbedding(userProfile);

    const minSimilarity = 0.5; // AI 추천 최소 유사도
    const maxDistance = 50; // 추천은 더 넓은 범위에서

    // AI 기반 유사도 계산
    const similarUsers = await this.embeddings.findSimilarProfiles(
      targetEmbedding,
      allUsers,
      minSimilarity
    );

    const recommendations: MatchResult[] = similarUsers
      .map(user => {
        const distance = this.embeddings.calculateDistance(userLocation, user.location);
        // AI 유사도를 기반으로 한 추천 점수 (거리는 보조 요소)
        const score = this.calculateRecommendationScore(user.similarity, distance, maxDistance);

        return {
          userId: user.userId,
          similarity: user.similarity,
          distance,
          location: user.location,
          score,
        };
      })
      .sort((a, b) => b.score - a.score); // 추천 점수 높은 순

    return recommendations.slice(0, limit);
  }

  private calculateMatchScore(similarity: number, distance: number, maxDistance: number): number {
    const distanceScore = Math.max(0, (maxDistance - distance) / maxDistance);

    const similarityWeight = 0.7;
    const distanceWeight = 0.3;

    return (similarity * similarityWeight) + (distanceScore * distanceWeight);
  }

  private calculateRecommendationScore(similarity: number, distance: number, maxDistance: number): number {
    // AI 추천에서는 유사도가 주요 요소, 거리는 보조
    const distanceScore = Math.max(0, (maxDistance - distance) / maxDistance);

    const similarityWeight = 0.9; // AI 유사도 중심
    const distanceWeight = 0.1;   // 거리는 보조적

    return (similarity * similarityWeight) + (distanceScore * distanceWeight);
  }

  async getEmbedding(text: string): Promise<number[]> {
    return this.bedrock.generateEmbedding(text);
  }
}
