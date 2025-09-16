import { Module } from '@nestjs/common';
import { LogController } from './log.controller';
import { LogService } from './log.service';
import { SafetyFilterModule } from '../safety-filter/safety-filter.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SafetyFilterModule, AuthModule],
  controllers: [LogController],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}