import { Module } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { AiProcessingController } from './ai-processing.controller';

@Module({
  controllers: [AiProcessingController],
  providers: [AiProcessingService],
})
export class AiProcessingModule {}
