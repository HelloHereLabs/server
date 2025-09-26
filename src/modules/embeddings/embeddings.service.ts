import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { Language, Interest, Purpose } from '../../constants/app.constants';

export interface UserProfile {
  interests: Interest[];
  purpose: Purpose;
  language: Language;
  nationality?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface UserEmbedding {
  userId: string;
  nickname?: string;
  embedding: number[];
  location: LocationData;
  timestamp?: Date;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly bedrockService: BedrockService) {}

  async generateProfileEmbedding(profile: UserProfile): Promise<number[]> {
    const profileText = this.profileToText(profile);
    return await this.bedrockService.generateEmbedding(profileText);
  }

  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] ** 2;
      norm2 += embedding2[i] ** 2;
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async findSimilarProfiles(
    targetEmbedding: number[],
    candidateEmbeddings: UserEmbedding[],
    threshold = 0.7
  ): Promise<Array<{ userId: string; nickname?: string; similarity: number; location: LocationData }>> {
    const similarities = await Promise.all(
      candidateEmbeddings.map(async (candidate) => {
        const similarity = await this.calculateSimilarity(
          targetEmbedding,
          candidate.embedding
        );
        return {
          userId: candidate.userId,
          nickname: candidate.nickname,
          similarity,
          location: candidate.location,
        };
      })
    );

    return similarities
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  private profileToText(profile: UserProfile): string {
    const parts = [];

    if (profile.interests?.length) {
      parts.push(`관심사: ${profile.interests.join(', ')}`);
    }

    if (profile.nationality) {
      parts.push(`국적: ${profile.nationality}`);
    }

    if (profile.language) {
      parts.push(`언어: ${profile.language}`);
    }

    if (profile.purpose) {
      parts.push(`목적: ${profile.purpose}`);
    }

    return parts.join('. ');
  }

  calculateDistance(loc1: LocationData, loc2: LocationData): number {
    console.log(`[EmbeddingsService] calculateDistance 호출:`, { loc1, loc2 });

    const R = 6371;
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const lat1 = this.toRad(loc1.latitude);
    const lat2 = this.toRad(loc2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    console.log(`[EmbeddingsService] 거리 계산 결과: ${distance}km`);

    return distance;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}