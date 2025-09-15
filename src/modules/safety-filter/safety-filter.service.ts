import { Injectable } from '@nestjs/common';

export interface SafetyResult {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  filteredMessage: string;
  blockedWords: string[];
}

@Injectable()
export class SafetyFilterService {
  private blockedWords = [
    // 욕설 및 비속어
    '씨발', '개새끼', '병신', '미친', '바보', '멍청이', '죽어', '죽을래',
    'fuck', 'shit', 'damn', 'bitch', 'stupid', 'idiot', 'kill', 'die',
    
    // 차별적 표현
    '흑인', '백인', '황인', '조선족', '짱깨', '쪽발이', '양키',
    'nigger', 'chink', 'gook', 'jap',
    
    // 성적 표현
    '섹스', '자위', '음란', '야동', '포르노',
    'sex', 'porn', 'nude', 'xxx',
    
    // 폭력적 표현
    '때리다', '폭력', '살인', '테러', '폭탄',
    'violence', 'murder', 'bomb', 'terror', 'attack',
    
    // 개인정보 패턴 (예시)
    '전화번호', '주민등록번호', '계좌번호', 'password', 'ssn'
  ];

  async checkMessage(message: string): Promise<SafetyResult> {
    const lowerMessage = message.toLowerCase();
    const foundBadWords: string[] = [];
    let filteredMessage = message;
    
    // 유해 단어 검사
    this.blockedWords.forEach(badWord => {
      const regex = new RegExp(badWord.toLowerCase(), 'gi');
      if (regex.test(lowerMessage)) {
        foundBadWords.push(badWord);
        filteredMessage = filteredMessage.replace(regex, '*'.repeat(badWord.length));
      }
    });

    // 위험도 계산
    const riskLevel = this.calculateRiskLevel(foundBadWords.length, message.length);
    
    // 안전성 판단
    const isSafe = foundBadWords.length === 0;

    return {
      isSafe,
      riskLevel,
      filteredMessage,
      blockedWords: foundBadWords,
    };
  }

  private calculateRiskLevel(badWordCount: number, messageLength: number): 'low' | 'medium' | 'high' {
    if (badWordCount === 0) return 'low';
    
    const badWordRatio = badWordCount / Math.max(messageLength / 10, 1);
    
    if (badWordRatio > 0.3 || badWordCount > 3) return 'high';
    if (badWordRatio > 0.1 || badWordCount > 1) return 'medium';
    
    return 'low';
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