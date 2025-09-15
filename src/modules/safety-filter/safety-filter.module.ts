import { Module } from '@nestjs/common';
import { SafetyFilterService } from './safety-filter.service';

@Module({
  providers: [SafetyFilterService],
  exports: [SafetyFilterService],
})
export class SafetyFilterModule {}