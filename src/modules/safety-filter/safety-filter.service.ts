import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';

export interface SafetyResult {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  filteredMessage: string;
  blockedWords: string[];
  aiDetection?: {
    confidence: number;
    categories: string[];
    reasoning?: string;
  };
}

export interface ContentAnalysis {
  toxicity: number;
  harassment: number;
  hateSpeech: number;
  sexualContent: number;
  violence: number;
  selfHarm: number;
  personalInfo: number;
}

@Injectable()
export class SafetyFilterService {
  private readonly logger = new Logger(SafetyFilterService.name);
  private blockedWords = [
    '개새끼', '병신', '죽어', '죽을래',
    'fuck', 'shit', 'bitch', 'kill', 'die',
    '차별', '혐오', '폭력', '테러',
    'violence', 'terror', 'attack'
  ];

  constructor(private readonly bedrock: BedrockService) {}

  async checkMessage(message: string): Promise<SafetyResult> {
    const [basicCheck, aiCheck] = await Promise.all([
      this.basicSafetyCheck(message),
      this.aiSafetyCheck(message)
    ]);

    const combinedResult: SafetyResult = {
      ...basicCheck,
      aiDetection: aiCheck,
      isSafe: basicCheck.isSafe && aiCheck.confidence < 0.7,
      riskLevel: this.combineRiskLevels(basicCheck.riskLevel, aiCheck.confidence)
    };

    return combinedResult;
  }

  private async basicSafetyCheck(message: string): Promise<SafetyResult> {
    const lowerMessage = message.toLowerCase();
    const foundBadWords: string[] = [];
    let filteredMessage = message;

    this.blockedWords.forEach(badWord => {
      const regex = new RegExp(badWord.toLowerCase(), 'gi');
      if (regex.test(lowerMessage)) {
        foundBadWords.push(badWord);
        filteredMessage = filteredMessage.replace(regex, '*'.repeat(badWord.length));
      }
    });

    const riskLevel = this.calculateRiskLevel(foundBadWords.length, message.length);
    const isSafe = foundBadWords.length === 0;

    return {
      isSafe,
      riskLevel,
      filteredMessage,
      blockedWords: foundBadWords,
    };
  }

  private async aiSafetyCheck(message: string): Promise<{
    confidence: number;
    categories: string[];
    reasoning?: string;
  }> {
    try {
      const isUnsafe = await this.bedrock.detectUnsafeContent(message);

      if (isUnsafe) {
        const analysis = await this.analyzeContentWithAI(message);
        return {
          confidence: 0.8,
          categories: analysis.categories,
          reasoning: analysis.reasoning
        };
      }

      return {
        confidence: 0.1,
        categories: [],
      };
    } catch (error) {
      this.logger.error('AI safety check failed:', error);
      return {
        confidence: 0.5,
        categories: ['unknown'],
      };
    }
  }

  private async analyzeContentWithAI(message: string): Promise<{
    categories: string[];
    reasoning: string;
  }> {
    const prompt = `다음 메시지를 분석하여 문제가 되는 카테고리와 이유를 설명해주세요:

메시지: "${message}"

다음 형식으로 답변해주세요:
카테고리: [욕설/혐오표현/폭력/성적내용/개인정보/기타] (여러 개 가능)
이유: 간단한 설명

예시:
카테고리: 욕설, 혐오표현
이유: 특정 집단에 대한 비하 표현이 포함됨`;

    try {
      const response = await this.bedrock.generateTextWithTitan(prompt, 100);
      return this.parseAIAnalysis(response);
    } catch (error) {
      this.logger.error('AI content analysis failed:', error);
      return {
        categories: ['기타'],
        reasoning: '분석 실패'
      };
    }
  }

  private parseAIAnalysis(response: string): { categories: string[]; reasoning: string } {
    const lines = response.split('\n');
    let categories: string[] = [];
    let reasoning = '';

    for (const line of lines) {
      if (line.startsWith('카테고리:')) {
        const categoryText = line.replace('카테고리:', '').trim();
        categories = categoryText.split(',').map(c => c.trim());
      } else if (line.startsWith('이유:')) {
        reasoning = line.replace('이유:', '').trim();
      }
    }

    return { categories, reasoning };
  }

  private calculateRiskLevel(badWordCount: number, messageLength: number): 'low' | 'medium' | 'high' {
    if (badWordCount === 0) return 'low';

    const badWordRatio = badWordCount / Math.max(messageLength / 10, 1);

    if (badWordRatio > 0.3 || badWordCount > 3) return 'high';
    if (badWordRatio > 0.1 || badWordCount > 1) return 'medium';

    return 'low';
  }

  private combineRiskLevels(
    basicRisk: 'low' | 'medium' | 'high',
    aiConfidence: number
  ): 'low' | 'medium' | 'high' {
    if (basicRisk === 'high' || aiConfidence > 0.8) return 'high';
    if (basicRisk === 'medium' || aiConfidence > 0.6) return 'medium';
    if (aiConfidence > 0.4) return 'medium';
    return 'low';
  }

  async checkPersonalInfo(message: string): Promise<{
    hasPersonalInfo: boolean;
    detectedTypes: string[];
    maskedMessage: string;
  }> {
    const patterns = {
      phone: /(\d{3}-?\d{3,4}-?\d{4}|\d{10,11})/g,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      koreanId: /\d{6}-[1-4]\d{6}/g,
      creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
      address: /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주).{1,50}(동|로|길)/g
    };

    const detectedTypes: string[] = [];
    let maskedMessage = message;

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        detectedTypes.push(type);
        maskedMessage = maskedMessage.replace(pattern, '***');
      }
    }

    return {
      hasPersonalInfo: detectedTypes.length > 0,
      detectedTypes,
      maskedMessage
    };
  }


  async addBlockedWord(word: string): Promise<void> {
    if (!this.blockedWords.includes(word.toLowerCase())) {
      this.blockedWords.push(word.toLowerCase());
    }
  }

  async removeBlockedWord(word: string): Promise<void> {
    const index = this.blockedWords.indexOf(word.toLowerCase());
    if (index > -1) {
      this.blockedWords.splice(index, 1);
    }
  }

  getBlockedWords(): string[] {
    return [...this.blockedWords];
  }
}