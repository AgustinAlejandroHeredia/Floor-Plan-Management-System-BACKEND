import { Module } from '@nestjs/common';
import { OrientationDetectionService } from './orientation-detection.service';

@Module({
  providers: [OrientationDetectionService],
  exports: [OrientationDetectionService],
})
export class OrientationDetectionModule {}
