import { Module } from '@nestjs/common';
import { SafetyFilterService } from './safety-filter.service';
import { SafetyFilterController } from './safety-filter.controller';
import { BedrockModule } from '../bedrock/bedrock.module';

@Module({
  imports: [BedrockModule],
  controllers: [SafetyFilterController],
  providers: [SafetyFilterService],
  exports: [SafetyFilterService],
})
export class SafetyFilterModule {}