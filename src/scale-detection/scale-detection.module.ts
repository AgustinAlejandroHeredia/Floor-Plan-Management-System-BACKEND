import { Module } from '@nestjs/common';
import { ScaleDetectionService } from './scale-detection.service';

@Module({
  providers: [ScaleDetectionService],
  exports: [ScaleDetectionService],
})
export class ScaleDetectionModule {}
