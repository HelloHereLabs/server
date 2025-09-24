import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';

export interface ConversationContext {
  userProfile: {
    interests: string[];
    nationality: string;
    language: string;
  };
  partnerProfile: {
    interests: string[];
    nationality: string;
    language: string;
  };
  previousMessages?: Array<{
    sender: 'user' | 'partner';
    content: string;
    timestamp: Date;
  }>;
}

export interface TopicSuggestion {
  topic: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  culturalContext?: string;
}

export interface IceBreaker {
  message: string;
  type: 'question' | 'compliment' | 'observation' | 'shared_interest';
  culturallyAppropriate: boolean;
}

@Injectable()
export class ChatAssistService {
  private readonly logger = new Logger(ChatAssistService.name);

  constructor(private readonly bedrock: BedrockService) {}

  async suggestConversationTopics(context: ConversationContext): Promise<TopicSuggestion[]> {
    const systemPrompt = `당신은 외국인과 현지인 간의 대화를 도와주는 문화적 중재자입니다.
두 사람의 프로필을 바탕으로 자연스럽고 흥미로운 대화 주제를 제안해주세요.

문화적 차이를 고려하여 민감하지 않고 흥미로울 수 있는 주제들을 추천해주세요.`;

    const prompt = `사용자 프로필:
- 관심사: ${context.userProfile.interests.join(', ')}
- 국적: ${context.userProfile.nationality}
- 언어: ${context.userProfile.language}

상대방 프로필:
- 관심사: ${context.partnerProfile.interests.join(', ')}
- 국적: ${context.partnerProfile.nationality}
- 언어: ${context.partnerProfile.language}

${context.previousMessages?.length ? `이전 대화:
${context.previousMessages.slice(-5).map(msg => `${msg.sender}: ${msg.content}`).join('\n')}` : ''}

다음 형식으로 5개의 대화 주제를 제안해주세요:
1. 주제명 | 카테고리 | 난이도 | 문화적 맥락
2. 주제명 | 카테고리 | 난이도 | 문화적 맥락
...`;

    try {
      const response = await this.bedrock.generateTextWithClaude(
        [{ role: 'user', content: prompt }],
        systemPrompt
      );

      return this.parseTopicSuggestions(response);
    } catch (error) {
      this.logger.error('Topic suggestion failed:', error);
      return this.getFallbackTopics(context);
    }
  }

  async generateIceBreakers(context: ConversationContext): Promise<IceBreaker[]> {
    const systemPrompt = `두 사람이 처음 만났을 때 사용할 수 있는 자연스러운 대화 시작 문장들을 제안해주세요.
문화적으로 적절하고 부담스럽지 않은 방식으로 대화를 시작할 수 있도록 도와주세요.`;

    const prompt = `상황: ${context.userProfile.nationality}인과 ${context.partnerProfile.nationality}인이 처음 만남
공통 관심사: ${this.findCommonInterests(context.userProfile.interests, context.partnerProfile.interests).join(', ')}

다음 형식으로 5개의 대화 시작 문장을 제안해주세요:
- 문장 | 유형(질문/칭찬/관찰/공통관심사) | 문화적적절성(true/false)`;

    try {
      const response = await this.bedrock.generateTextWithClaude(
        [{ role: 'user', content: prompt }],
        systemPrompt
      );

      return this.parseIceBreakers(response);
    } catch (error) {
      this.logger.error('Ice breaker generation failed:', error);
      return this.getFallbackIceBreakers();
    }
  }

  async provideCulturalContext(
    message: string,
    senderNationality: string,
    receiverNationality: string
  ): Promise<string> {
    const prompt = `다음 메시지가 ${senderNationality}에서 ${receiverNationality}로 전달될 때
문화적 맥락이나 오해 가능성에 대해 간단히 설명해주세요:

메시지: "${message}"

50자 이내로 간단한 설명을 제공해주세요.`;

    try {
      const response = await this.bedrock.generateTextWithClaude([
        { role: 'user', content: prompt }
      ]);

      return response.trim();
    } catch (error) {
      this.logger.error('Cultural context failed:', error);
      return '';
    }
  }

  async suggestResponse(
    receivedMessage: string,
    context: ConversationContext
  ): Promise<string[]> {
    const systemPrompt = `받은 메시지에 대해 자연스럽고 친근한 응답 옵션들을 제안해주세요.
문화적 차이를 고려하여 적절한 톤과 내용으로 응답할 수 있도록 도와주세요.`;

    const prompt = `받은 메시지: "${receivedMessage}"

응답자 정보:
- 관심사: ${context.userProfile.interests.join(', ')}
- 국적: ${context.userProfile.nationality}

3가지 응답 옵션을 제안해주세요:
1. 친근한 톤
2. 질문으로 대화 이어가기
3. 공감 표현하기`;

    try {
      const response = await this.bedrock.generateTextWithClaude(
        [{ role: 'user', content: prompt }],
        systemPrompt
      );

      return this.parseResponseSuggestions(response);
    } catch (error) {
      this.logger.error('Response suggestion failed:', error);
      return ['좋은 생각이네요!', '더 자세히 이야기해주세요.', '저도 비슷한 경험이 있어요.'];
    }
  }

  private parseTopicSuggestions(response: string): TopicSuggestion[] {
    const lines = response.split('\n').filter(line => line.trim());
    const topics: TopicSuggestion[] = [];

    for (const line of lines) {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length >= 3) {
        topics.push({
          topic: parts[0].replace(/^\d+\.\s*/, ''),
          category: parts[1],
          difficulty: parts[2] as 'easy' | 'medium' | 'hard',
          culturalContext: parts[3] || undefined
        });
      }
    }

    return topics.slice(0, 5);
  }

  private parseIceBreakers(response: string): IceBreaker[] {
    const lines = response.split('\n').filter(line => line.trim());
    const iceBreakers: IceBreaker[] = [];

    for (const line of lines) {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length >= 3) {
        iceBreakers.push({
          message: parts[0].replace(/^-\s*/, ''),
          type: parts[1] as 'question' | 'compliment' | 'observation' | 'shared_interest',
          culturallyAppropriate: parts[2] === 'true'
        });
      }
    }

    return iceBreakers.slice(0, 5);
  }

  private parseResponseSuggestions(response: string): string[] {
    const lines = response.split('\n').filter(line => line.trim());
    return lines
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 3);
  }

  private findCommonInterests(interests1: string[], interests2: string[]): string[] {
    return interests1.filter(interest =>
      interests2.some(otherInterest =>
        interest.toLowerCase() === otherInterest.toLowerCase()
      )
    );
  }

  private getFallbackTopics(context: ConversationContext): TopicSuggestion[] {
    return [
      { topic: '좋아하는 음식', category: '문화', difficulty: 'easy' },
      { topic: '여행 경험', category: '경험', difficulty: 'medium' },
      { topic: '취미 활동', category: '개인', difficulty: 'easy' },
      { topic: '언어 학습', category: '교육', difficulty: 'medium' },
      { topic: '현지 문화', category: '문화', difficulty: 'medium' }
    ];
  }

  private getFallbackIceBreakers(): IceBreaker[] {
    return [
      { message: '안녕하세요! 만나서 반가워요.', type: 'compliment', culturallyAppropriate: true },
      { message: '어떤 음식을 좋아하시나요?', type: 'question', culturallyAppropriate: true },
      { message: '한국에 온 지 얼마나 되셨나요?', type: 'question', culturallyAppropriate: true }
    ];
  }
}