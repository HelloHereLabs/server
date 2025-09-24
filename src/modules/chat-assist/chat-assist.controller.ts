import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatAssistService, ConversationContext } from './chat-assist.service';

@ApiTags('대화 보조 서비스')
@Controller('chat-assist')
export class ChatAssistController {
  constructor(private readonly chatAssistService: ChatAssistService) {}

  @Post('suggest-topics')
  @ApiOperation({ summary: '대화 주제 추천' })
  @ApiResponse({ status: 200, description: '추천 대화 주제 목록 반환' })
  async suggestTopics(@Body() context: ConversationContext) {
    return {
      topics: await this.chatAssistService.suggestConversationTopics(context)
    };
  }

  @Post('ice-breakers')
  @ApiOperation({ summary: '대화 시작 문장 생성' })
  @ApiResponse({ status: 200, description: '대화 시작 문장 목록 반환' })
  async generateIceBreakers(@Body() context: ConversationContext) {
    return {
      iceBreakers: await this.chatAssistService.generateIceBreakers(context)
    };
  }

  @Post('cultural-context')
  @ApiOperation({ summary: '문화적 맥락 제공' })
  @ApiResponse({ status: 200, description: '문화적 맥락 정보 반환' })
  async provideCulturalContext(@Body() request: {
    message: string;
    senderNationality: string;
    receiverNationality: string;
  }) {
    return {
      culturalContext: await this.chatAssistService.provideCulturalContext(
        request.message,
        request.senderNationality,
        request.receiverNationality
      )
    };
  }

  @Post('conversation-analysis')
  @ApiOperation({ summary: '대화 분석 및 후속 활동 제안' })
  @ApiResponse({ status: 200, description: '대화 분석 결과 반환' })
  async analyzeConversation(@Body() request: {
    context: ConversationContext;
    currentMessage?: string;
  }) {
    const topics = await this.chatAssistService.suggestConversationTopics(request.context);
    const iceBreakers = await this.chatAssistService.generateIceBreakers(request.context);

    return {
      suggestedTopics: topics,
      iceBreakers,
      analysis: {
        commonInterests: request.context.userProfile.interests.filter(interest =>
          request.context.partnerProfile.interests.includes(interest)
        ),
        culturalDifference: request.context.userProfile.nationality !== request.context.partnerProfile.nationality,
        languageDifference: request.context.userProfile.language !== request.context.partnerProfile.language
      }
    };
  }
}