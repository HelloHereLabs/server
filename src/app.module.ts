import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { BedrockModule } from './modules/bedrock/bedrock.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { MatchingModule } from './modules/matching/matching.module';
import { TranslationModule } from './modules/translation/translation.module';
import { ChatAssistModule } from './modules/chat-assist/chat-assist.module';
import { SafetyFilterModule } from './modules/safety-filter/safety-filter.module';
import { LogModule } from './modules/log/log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30,
    }]),
    DatabaseModule,
    AuthModule,
    UserModule,
    BedrockModule,
    EmbeddingsModule,
    MatchingModule,
    TranslationModule,
    ChatAssistModule,
    SafetyFilterModule,
    LogModule,
  ],
})
export class AppModule {}