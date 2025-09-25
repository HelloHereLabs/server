import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { BedrockModule } from '../bedrock/bedrock.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [BedrockModule, EmbeddingsModule, UserModule, DatabaseModule],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}