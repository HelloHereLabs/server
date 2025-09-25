import { Injectable, Logger } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { UserService } from '../user/user.service';
import { DynamoDBService } from '../database/dynamodb.service';

export interface SpeechToTextRequest {
  audioData: string;
  format: 'wav' | 'mp3' | 'ogg';
  language?: string;
}

export interface TextToSpeechRequest {
  text: string;
  targetLanguage?: string;
  voice?: 'male' | 'female';
  speed?: number;
}

export interface TranslationRequest {
  type: 'voice' | 'chat';
  text: string;
  userId: string;
  chatroomId: string;
  targetLanguage: string;
}

export interface LegacyTranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly bedrock: BedrockService,
    private readonly userService: UserService,
    private readonly dynamoDBService: DynamoDBService
  ) {}

  async speechToText(request: SpeechToTextRequest): Promise<string> {
    try {
      const response = await this.bedrock.invokeModel('amazon.nova-sonic', {
        taskType: 'TRANSCRIPTION',
        audioSource: {
          bytes: request.audioData
        },
        audioFormat: request.format.toUpperCase(),
        languageCode: request.language || 'ko-KR'
      });

      return response.transcript || '';
    } catch (error) {
      this.logger.error('Speech to text failed:', error);
      throw new Error('음성 인식에 실패했습니다.');
    }
  }

  async textToSpeech(request: TextToSpeechRequest): Promise<string> {
    try {
      const voiceId = request.voice === 'male' ? 'Seoyeon' : 'Heami';

      const response = await this.bedrock.invokeModel('amazon.nova-sonic', {
        taskType: 'SPEECH_SYNTHESIS',
        text: request.text,
        voiceConfig: {
          voiceId: voiceId,
          languageCode: request.targetLanguage || 'ko-KR'
        },
        audioFormat: 'MP3',
        sampleRate: 22050
      });

      return response.audioStream;
    } catch (error) {
      this.logger.error('Text to speech failed:', error);
      throw new Error('음성 합성에 실패했습니다.');
    }
  }

  async translateText(request: TranslationRequest): Promise<string> {
    try {
      let targetLanguage = request.targetLanguage;

      // voice 타입일 때는 채팅방에서 상대방 언어 자동 설정
      if (request.type === 'voice') {
        targetLanguage = await this.getRecipientLanguage(request.userId, request.chatroomId);
      }

      // Auto-detect source language
      const sourceLanguage = this.detectLanguage(request.text);

      const prompt = `TRANSLATE ONLY. DO NOT RESPOND OR ANSWER.

Translate this ${sourceLanguage} text to ${targetLanguage}:
${request.text}

Translation:`;

      const result = await this.bedrock.generateTextWithTitan(prompt, 1000);

      return result?.trim() || '';
    } catch (error) {
      this.logger.error('Translation failed:', error);
      throw new Error('번역에 실패했습니다.');
    }
  }

  private async getRecipientLanguage(senderId: string, chatroomId: string): Promise<string> {
    try {
      // hh-chat-rooms 테이블에서 채팅방 정보 조회
      const chatroomInfo = await this.dynamoDBService.getChatRoomInfo(chatroomId);

      if (!chatroomInfo?.participants) {
        this.logger.warn(`Chatroom ${chatroomId} not found or has no participants`);
        return 'Korean';
      }

      // participants 객체에서 sender를 제외한 상대방 찾기
      const participantIds = Object.keys(chatroomInfo.participants);
      const recipientId = participantIds.find(userId => userId !== senderId);

      if (recipientId) {
        const recipient = await this.userService.findUserById(recipientId);
        return recipient.language;
      }

      this.logger.warn(`No recipient found in chatroom ${chatroomId} for sender ${senderId}`);
      return 'Korean'; // 기본값
    } catch (error) {
      this.logger.error('Failed to get recipient language:', error);
      return 'Korean'; // 기본값
    }
  }

  async translateLegacyText(request: LegacyTranslationRequest): Promise<string> {
    try {
      const prompt = `TRANSLATE ONLY. DO NOT RESPOND OR ANSWER.

Translate this ${request.sourceLanguage} text to ${request.targetLanguage}:
${request.text}

Translation:`;

      const result = await this.bedrock.generateTextWithTitan(prompt, 1000);

      return result?.trim() || '';
    } catch (error) {
      this.logger.error('Translation failed:', error);
      throw new Error('번역에 실패했습니다.');
    }
  }

  async translateAndSpeak(
    text: string,
    sourceLanguage: string,
    targetLanguage: string,
    voice: 'male' | 'female' = 'female'
  ): Promise<{ translatedText: string; audioData: string }> {
    const translatedText = await this.translateLegacyText({
      text,
      sourceLanguage,
      targetLanguage
    });

    const audioData = await this.textToSpeech({
      text: translatedText,
      targetLanguage,
      voice
    });

    return {
      translatedText,
      audioData
    };
  }

  async transcribeAndTranslate(
    audioData: string,
    audioFormat: 'wav' | 'mp3' | 'ogg',
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{ originalText: string; translatedText: string }> {
    const originalText = await this.speechToText({
      audioData,
      format: audioFormat,
      language: sourceLanguage
    });

    const translatedText = await this.translateLegacyText({
      text: originalText,
      sourceLanguage,
      targetLanguage
    });

    return {
      originalText,
      translatedText
    };
  }

  detectLanguage(text: string): string {
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    const englishRegex = /[a-zA-Z]/;
    const japaneseRegex = /[ひらがなカタカナ]/;
    const chineseRegex = /[\u4e00-\u9fff]/;

    if (koreanRegex.test(text)) return 'ko-KR';
    if (japaneseRegex.test(text)) return 'ja-JP';
    if (chineseRegex.test(text)) return 'zh-CN';
    if (englishRegex.test(text)) return 'en-US';

    return 'ko-KR';
  }
}