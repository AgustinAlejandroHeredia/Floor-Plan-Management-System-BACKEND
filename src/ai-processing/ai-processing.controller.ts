import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { CreateAiProcessingDto } from './dto/create-ai-processing.dto';
import { UpdateAiProcessingDto } from './dto/update-ai-processing.dto';

@Controller('ai-processing')
export class AiProcessingController {
  constructor(private readonly aiProcessingService: AiProcessingService) {}

  @Get()
  processBlueprint() {
    return this.aiProcessingService.processBlueprint()
  }

}
