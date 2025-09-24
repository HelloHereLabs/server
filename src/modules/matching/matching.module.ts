import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { BedrockModule } from '../bedrock/bedrock.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [BedrockModule, EmbeddingsModule],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}