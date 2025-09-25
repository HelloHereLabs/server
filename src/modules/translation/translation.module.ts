import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { BedrockModule } from '../bedrock/bedrock.module';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [BedrockModule, UserModule, DatabaseModule],
  controllers: [TranslationController],
  providers: [TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}