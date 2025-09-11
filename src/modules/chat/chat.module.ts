import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SafetyFilterModule } from '../safety-filter/safety-filter.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SafetyFilterModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}