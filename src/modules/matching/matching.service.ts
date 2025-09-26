import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmbeddingsService, UserProfile, LocationData, UserEmbedding } from '../embeddings/embeddings.service';
import { UserService } from '../user/user.service';
import { User } from '../../entities/user.entity';
import { DynamoDBService } from '../database/dynamodb.service';

interface EmbeddingCache {
  embedding: number[];
  createdAt: Date;
  ttl: number; // 24시간 (밀리초)
}

export interface MatchRequest {
  userId: string;
  profile: UserProfile;
  location: LocationData;
  maxDistance?: number;
  minSimilarity?: number;
}

export interface MatchResult {
  userId: string;
  nickname?: string;
  similarity: number;
  distance: number;
  location: LocationData;
  score: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly embeddingCache = new Map<string, EmbeddingCache>();
  private readonly CACHE_TTL = (parseInt(process.env.EMBEDDING_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

  constructor(
    private readonly bedrock: BedrockService,
    private readonly embeddings: EmbeddingsService,
    private readonly userService: UserService,
    private readonly dynamoDBService: DynamoDBService,
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
          nickname: user.nickname,
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
          nickname: user.nickname,
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

  async getLocationBasedRecommendations(userId: string): Promise<{
    recommendedUsers: MatchResult[];
    message: string;
  }> {
    try {
      console.log(`[MatchingService] getLocationBasedRecommendations 호출됨 - userId: ${userId} (type: ${typeof userId})`);

      // userId 유효성 검사
      if (!userId || userId.trim() === '') {
        console.error(`[MatchingService] userId 유효성 검사 실패 - userId: ${userId}`);
        this.logger.error('userId가 제공되지 않았습니다');
        throw new Error('userId가 제공되지 않았습니다');
      }

      console.log(`[MatchingService] userId 유효성 검사 통과`);
      this.logger.log(`매칭 추천 시작 - userId: ${userId}`);

      // 1. 사용자 정보 조회 (병렬 처리)
      const [userProfile, userLocation] = await Promise.all([
        this.getUserProfile(userId).catch(error => {
          this.logger.error(`사용자 프로필 조회 실패 (userId: ${userId}):`, error);
          throw new Error(`사용자 프로필을 찾을 수 없습니다: ${error.message}`);
        }),
        this.getUserLocation(userId).catch(error => {
          this.logger.error(`사용자 위치 조회 실패 (userId: ${userId}):`, error);
          throw new Error(`사용자 위치를 찾을 수 없습니다: ${error.message}`);
        })
      ]);

      this.logger.log(`사용자 정보 조회 완료 - userId: ${userId}`);

      // 요청자 위치 체크
      if (userLocation.latitude === 0 && userLocation.longitude === 0) {
        console.log(`[MatchingService] 요청자가 (0, 0) 좌표에 있음. 위치 설정 필요.`);
        return {
          recommendedUsers: [],
          message: '위치 정보를 설정해주세요.'
        };
      }

      // 2. 활성 사용자들 조회 (타임아웃 설정)
      let activeUsers: UserEmbedding[];
      try {
        activeUsers = await Promise.race([
          this.getActiveUsers(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('활성 사용자 조회 타임아웃')), 10000)
          )
        ]);
        this.logger.log(`활성 사용자 조회 완료: ${activeUsers.length}명`);
      } catch (error) {
        this.logger.error('활성 사용자 조회 실패:', error);
        // 빈 배열 반환하여 서비스 계속 진행
        return {
          recommendedUsers: [],
          message: '현재 활성 사용자를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.'
        };
      }

      // 3. 1km 이내 사용자 필터링
      const nearbyUsers = this.filterUsersByDistance(userLocation, activeUsers, 1.0);
      this.logger.log(`1km 이내 사용자: ${nearbyUsers.length}명`);

      if (nearbyUsers.length === 0) {
        return {
          recommendedUsers: [],
          message: '1km 이내에 활성 사용자가 없습니다.'
        };
      }

      // 4. 관심사/목적 기반 유사도 계산 및 매칭
      let recommendations: MatchResult[];
      try {
        recommendations = await this.calculateMatchingScores(userId, userProfile, userLocation, nearbyUsers);
        this.logger.log(`매칭 점수 계산 완료: ${recommendations.length}명`);
      } catch (error) {
        this.logger.error('매칭 점수 계산 실패:', error);
        // 거리 기반으로만 매칭 결과 반환
        // 거리 기반으로만 최고 매칭 1명 반환
        recommendations = nearbyUsers.map((user, index) => ({
          userId: user.userId,
          nickname: user.nickname,
          similarity: 0,
          distance: this.embeddings.calculateDistance(userLocation, user.location),
          location: user.location,
          score: 1 - index * 0.1 // 순서대로 점수 부여
        })).slice(0, 1);
      }

      return {
        recommendedUsers: recommendations,
        message: recommendations.length > 0
          ? `최고 매칭 사용자 1명을 찾았습니다.`
          : '매칭되는 사용자가 없습니다.'
      };

    } catch (error) {
      this.logger.error(`매칭 추천 전체 실패 (userId: ${userId}):`, error);
      return {
        recommendedUsers: [],
        message: '매칭 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      };
    }
  }

  private filterUsersByDistance(userLocation: LocationData, users: UserEmbedding[], maxDistanceKm: number): UserEmbedding[] {
    console.log(`[MatchingService] filterUsersByDistance 시작 - userLocation:`, userLocation, `maxDistance: ${maxDistanceKm}km`);
    console.log(`[MatchingService] 필터링 대상 사용자 수: ${users.length}`);

    const filteredUsers = users.filter(user => {
      // (0, 0) 좌표인 사용자 제외
      if (user.location.latitude === 0 && user.location.longitude === 0) {
        console.log(`[MatchingService] 사용자 ${user.userId}: (0, 0) 좌표로 제외됨`);
        return false;
      }

      const distance = this.embeddings.calculateDistance(userLocation, user.location);
      const isWithinDistance = distance <= maxDistanceKm;
      console.log(`[MatchingService] 사용자 ${user.userId}: 거리 ${distance.toFixed(2)}km, 범위내: ${isWithinDistance}`);
      return isWithinDistance;
    });

    console.log(`[MatchingService] 필터링 결과: ${filteredUsers.length}명`);
    return filteredUsers;
  }

  private async calculateMatchingScores(
    userId: string,
    userProfile: UserProfile,
    userLocation: LocationData,
    candidateUsers: UserEmbedding[]
  ): Promise<MatchResult[]> {
    const userEmbedding = await this.getCachedEmbedding(userId, userProfile);

    const matchResults: MatchResult[] = [];

    for (const candidate of candidateUsers) {
      if (candidate.userId === userId) continue;

      // 관심사/목적 유사도 계산
      const similarity = this.calculateCosineSimilarity(userEmbedding, candidate.embedding);

      // 거리 계산
      const distance = this.embeddings.calculateDistance(userLocation, candidate.location);

      // 최종 매칭 점수 계산 (거리 + 관심사 + 목적 가중치 합산)
      const score = this.calculateLocationBasedScore(similarity, distance);

      matchResults.push({
        userId: candidate.userId,
        nickname: candidate.nickname,
        similarity,
        distance,
        location: candidate.location,
        score
      });
    }

    // 점수 순으로 정렬하여 최고 매칭 1명만 반환
    return matchResults.sort((a, b) => b.score - a.score).slice(0, 1);
  }

  private calculateLocationBasedScore(similarity: number, distance: number): number {
    // 거리 점수 (가까울수록 높음, 1km 기준)
    const distanceScore = Math.max(0, (1.0 - distance) / 1.0);

    // 가중치: 관심사/목적(70%) + 거리(30%)
    const similarityWeight = 0.7;
    const distanceWeight = 0.3;

    return (similarity * similarityWeight) + (distanceScore * distanceWeight);
  }

  private async getCachedEmbedding(userId: string, profile: UserProfile): Promise<number[]> {
    try {
      const cacheKey = `${userId}_${this.generateProfileHash(profile)}`;
      const cached = this.embeddingCache.get(cacheKey);

      // 캐시 유효성 검사
      if (cached && Date.now() - cached.createdAt.getTime() < this.CACHE_TTL) {
        this.logger.debug(`임베딩 캐시 히트 - userId: ${userId}`);
        return cached.embedding;
      }

      this.logger.debug(`임베딩 생성 시작 - userId: ${userId}`);

      // 새로운 임베딩 생성 (재시도 로직 포함)
      let embedding: number[];
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount < maxRetries) {
        try {
          embedding = await this.embeddings.generateProfileEmbedding(profile);
          break;
        } catch (error) {
          retryCount++;
          this.logger.warn(`임베딩 생성 실패 (시도 ${retryCount}/${maxRetries}) - userId: ${userId}:`, error);

          if (retryCount >= maxRetries) {
            this.logger.error(`임베딩 생성 최대 재시도 실패 - userId: ${userId}`);
            // 기본 임베딩 반환 (프로필 텍스트 기반 간단한 해시)
            return this.generateFallbackEmbedding(profile);
          }

          // 재시도 전 짧은 대기 (Lambda 최적화)
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
        }
      }

      // 캐시에 저장
      this.embeddingCache.set(cacheKey, {
        embedding,
        createdAt: new Date(),
        ttl: this.CACHE_TTL
      });

      this.logger.debug(`임베딩 생성 완료 - userId: ${userId}, 차원: ${embedding.length}`);
      return embedding;

    } catch (error) {
      this.logger.error(`getCachedEmbedding 전체 실패 - userId: ${userId}:`, error);
      return this.generateFallbackEmbedding(profile);
    }
  }

  private generateFallbackEmbedding(profile: UserProfile): number[] {
    // 간단한 해시 기반 임베딩 생성 (fallback)
    const text = `${profile.interests.join(' ')} ${profile.purpose} ${profile.language}`;
    const hash = Buffer.from(text).toString('base64');

    // 환경변수에서 임베딩 차원 가져오기
    const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS) || 1024;
    const embedding = new Array(dimensions).fill(0);
    for (let i = 0; i < hash.length && i < embedding.length; i++) {
      embedding[i] = hash.charCodeAt(i) / 255; // 0-1 사이 값으로 정규화
    }

    this.logger.debug('Fallback 임베딩 생성됨');
    return embedding;
  }

  private generateProfileHash(profile: UserProfile): string {
    return Buffer.from(JSON.stringify({
      interests: profile.interests,
      purpose: profile.purpose,
      language: profile.language
    })).toString('base64');
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async getUserProfile(userId: string): Promise<UserProfile> {
    console.log(`[MatchingService] getUserProfile 시작 - userId: ${userId}`);
    const user = await this.userService.findUserById(userId);
    console.log(`[MatchingService] getUserProfile 완료 - user:`, {
      userId: user.userId,
      interests: user.interests,
      purpose: user.purpose,
      language: user.language
    });
    return {
      interests: user.interests,
      purpose: user.purpose,
      language: user.language,
    };
  }

  private async getUserLocation(userId: string): Promise<LocationData> {
    console.log(`[MatchingService] getUserLocation 시작 - userId: ${userId}`);
    const user = await this.userService.findUserById(userId);
    console.log(`[MatchingService] getUserLocation 완료 - location:`, user.location);
    return user.location;
  }

  private async getActiveUsers(): Promise<UserEmbedding[]> {
    try {
      // DynamoDB에서 활성 사용자만 직접 조회
      this.logger.log('활성 사용자 조회 시작');
      const allActiveUsers = await this.dynamoDBService.scanActiveUsers();

      // 처리 속도를 위해 최대 5명으로 제한 (최고 매칭 1명 추천용)
      const activeUsers = allActiveUsers.slice(0, 5);
      this.logger.log(`DynamoDB에서 ${allActiveUsers.length}명 조회됨, ${activeUsers.length}명 처리 예정`);

      if (activeUsers.length === 0) {
        return [];
      }

      // Lambda에서 효율적인 병렬 처리 (배치 크기 축소)
      const batchSize = 2;
      const userEmbeddings: UserEmbedding[] = [];

      for (let i = 0; i < activeUsers.length; i += batchSize) {
        const batch = activeUsers.slice(i, i + batchSize);

        try {
          const batchEmbeddings = await Promise.all(
            batch.map(async (user) => {
              try {
                const profile: UserProfile = {
                  interests: user.interests || [],
                  purpose: user.purpose,
                  language: user.language,
                };

                // 사용자 임베딩 생성 (캐시 활용)
                const embedding = await Promise.race([
                  this.getCachedEmbedding(user.userId, profile),
                  new Promise<number[]>((_, reject) =>
                    setTimeout(() => reject(new Error('임베딩 생성 타임아웃')), 3000)
                  )
                ]);

                return {
                  userId: user.userId,
                  nickname: user.nickname,
                  embedding,
                  location: user.location,
                  profile,
                };
              } catch (error) {
                this.logger.warn(`사용자 ${user.userId} 임베딩 생성 실패:`, error);
                // 기본 임베딩으로 처리 (빈 벡터)
                return {
                  userId: user.userId,
                  nickname: user.nickname,
                  embedding: new Array(1024).fill(0), // Titan v2 임베딩 차원
                  location: user.location,
                  profile: {
                    interests: user.interests || [],
                    purpose: user.purpose,
                    language: user.language,
                  },
                };
              }
            })
          );

          userEmbeddings.push(...batchEmbeddings);
          this.logger.log(`배치 ${Math.floor(i/batchSize) + 1} 완료: ${batchEmbeddings.length}명`);

        } catch (error) {
          this.logger.error(`배치 ${Math.floor(i/batchSize) + 1} 처리 실패:`, error);
          // 해당 배치는 건너뛰고 계속 진행
        }
      }

      this.logger.log(`총 ${userEmbeddings.length}명의 사용자 임베딩 완료`);
      return userEmbeddings;

    } catch (error) {
      this.logger.error('활성 사용자 조회 중 오류:', error);
      throw new Error(`활성 사용자 조회 실패: ${error.message}`);
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    return this.bedrock.generateEmbedding(text);
  }
}
