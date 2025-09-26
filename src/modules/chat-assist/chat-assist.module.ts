import { Module } from '@nestjs/common';
import { ChatAssistService } from './chat-assist.service';
import { ChatAssistController } from './chat-assist.controller';
import { BedrockModule } from '../bedrock/bedrock.module';

@Module({
  imports: [BedrockModule],
  controllers: [ChatAssistController],
  providers: [ChatAssistService],
  exports: [ChatAssistService],
})
export class ChatAssistModule {}