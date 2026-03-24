import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { BlueprintController } from './blueprint.controller';

@Module({
  controllers: [BlueprintController],
  providers: [BlueprintService],
})
export class BlueprintModule {}
