import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TranslationService, SpeechToTextRequest, TextToSpeechRequest, TranslationRequest } from './translation.service';

@ApiTags('번역 서비스')
@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('speech-to-text')
  @ApiOperation({ summary: '음성을 텍스트로 변환 (STT)' })
  @ApiResponse({ status: 200, description: '변환된 텍스트 반환' })
  async speechToText(@Body() request: SpeechToTextRequest) {
    return {
      text: await this.translationService.speechToText(request)
    };
  }

  @Post('text-to-speech')
  @ApiOperation({ summary: '텍스트를 음성으로 변환 (TTS)' })
  @ApiResponse({ status: 200, description: '생성된 음성 데이터 반환' })
  async textToSpeech(@Body() request: TextToSpeechRequest) {
    return {
      audioData: await this.translationService.textToSpeech(request)
    };
  }

  @Post('translate')
  @ApiOperation({ summary: '텍스트 번역' })
  @ApiResponse({ status: 200, description: '번역된 텍스트 반환' })
  async translateText(@Body() request: TranslationRequest) {
    return {
      translatedText: await this.translationService.translateText(request)
    };
  }
}