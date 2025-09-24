import { Injectable, Logger } from '@nestjs/common';
import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export interface EmbeddingRequest {
  inputText: string;
  dimensions?: number;
  normalize?: boolean;
}

export interface EmbeddingResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

export interface TitanTextRequest {
  inputText: string;
  textGenerationConfig?: {
    maxTokenCount?: number;
    stopSequences?: string[];
    temperature?: number;
    topP?: number;
  };
}

export interface ClaudeRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  system?: string;
}

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: 'us-east-1', // Bedrock은 항상 us-east-1 사용
    });
  }

  async invokeModel(modelId: string, body: any): Promise<any> {
    try {
      const command = new InvokeModelCommand({
        modelId: modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.client.send(command);
      return JSON.parse(new TextDecoder().decode(response.body));
    } catch (error) {
      this.logger.error(`Failed to invoke model ${modelId}:`, error);
      throw error;
    }
  }



  async generateEmbedding(text: string): Promise<number[]> {
    const body: EmbeddingRequest = {
      inputText: text,
      dimensions: 1024,
      normalize: true,
    };

    const response = await this.invokeModel(
      'amazon.titan-embed-text-v2:0',
      body
    );

    return response.embedding;
  }

  async generateTextWithTitan(prompt: string, maxTokens = 512): Promise<string> {
    const body: TitanTextRequest = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: maxTokens,
        temperature: 0.7,
        topP: 0.9,
      },
    };

    const response = await this.invokeModel(
      'amazon.titan-text-express-v1',
      body
    );

    return response.results[0].outputText;
  }

  async generateTextWithClaude(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    maxTokens = 1000
  ): Promise<string> {
    const body: ClaudeRequest = {
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await this.invokeModel(
      'arn:aws:bedrock:us-east-1:327784329358:inference-profile/us.anthropic.claude-3-5-sonnet-20240620-v1:0',
      body
    );

    return response.content[0].text;
  }

  async detectUnsafeContent(text: string): Promise<boolean> {
    const prompt = `다음 텍스트가 안전하지 않은 내용(욕설, 혐오 표현, 개인정보, 부적절한 내용)을 포함하는지 분석해주세요.
안전하지 않다면 "UNSAFE", 안전하다면 "SAFE"로만 답변해주세요.

텍스트: ${text}`;

    const body: TitanTextRequest = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: 10,
        temperature: 0.1,
      },
    };

    const response = await this.invokeModel(
      'amazon.titan-text-express-v1',
      body
    );

    return response.results[0].outputText.trim().includes('UNSAFE');
  }

  async refreshCredentials(newCredentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }): Promise<void> {
    this.logger.log('Refreshing Bedrock credentials');
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: newCredentials,
    });
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // 간단한 모델 호출로 자격증명 유효성 검사
      await this.generateTextWithTitan('test', 10);
      return true;
    } catch (error) {
      this.logger.error('Credentials validation failed:', error);
      return false;
    }
  }

  async converseWithModel(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    modelId = 'amazon.nova-lite-v1:0'
  ): Promise<string> {
    try {
      // Converse API는 표준 AWS SDK만 사용 (Bearer Token 사용 안 함)
      const converseRequest = {
        modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: [{ text: msg.content }]
        })),
        system: systemPrompt ? [{ text: systemPrompt }] : undefined,
      };

        const response = await this.client.send(new ConverseCommand(converseRequest));

      if (response.output?.message?.content?.[0]?.text) {
        return response.output.message.content[0].text;
      }

      throw new Error('No text response from model');
    } catch (error) {
      this.logger.error(`Failed to converse with model ${modelId}:`, error);
      throw error;
    }
  }

  async converseWithTools(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    tools: any[],
    systemPrompt?: string,
    modelId = 'amazon.nova-lite-v1:0'
  ): Promise<any> {
    try {
      const converseRequest = {
        modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: [{ text: msg.content }]
        })),
        system: systemPrompt ? [{ text: systemPrompt }] : undefined,
        toolConfig: {
          tools: tools
        }
      };

      const response = await this.client.send(new ConverseCommand(converseRequest));
      return response;
    } catch (error) {
      this.logger.error(`Failed to converse with tools using model ${modelId}:`, error);
      throw error;
    }
  }
}
