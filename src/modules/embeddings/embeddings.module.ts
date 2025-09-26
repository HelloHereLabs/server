import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { BedrockModule } from '../bedrock/bedrock.module';

@Module({
  imports: [BedrockModule],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}