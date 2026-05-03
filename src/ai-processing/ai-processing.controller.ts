import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { CreateAiProcessingDto } from './dto/create-ai-processing.dto';
import { UpdateAiProcessingDto } from './dto/update-ai-processing.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@ApiTags('AI-processing')
@ApiBearerAuth('access-token')
@Controller('ai-processing')
export class AiProcessingController {

  constructor(
    private readonly aiProcessingService: AiProcessingService
  ) {}

  @Get()
  processBlueprint() {
    return this.aiProcessingService.processBlueprint()
  }

  @Get('/exampleShapes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get example shapes' })
  @ApiResponse({ status: 200, description: 'Shapes list sent' })
  getExampleShapes(){
    return this.aiProcessingService.getExampleShapes()
  }

}
