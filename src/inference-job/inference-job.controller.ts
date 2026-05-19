import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InferenceJobService } from './inference-job.service';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@ApiTags('inference-jobs')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class InferenceJobController {
  constructor(private readonly inferenceJobService: InferenceJobService) {}

  // REACHED BY CLIENT
  @Post('blueprints/:blueprintId/inference-jobs')
  @ApiOperation({ summary: 'Enqueue an inference job for a blueprint' })
  @ApiParam({ name: 'blueprintId', description: 'Blueprint ID' })
  @ApiResponse({ status: 201, description: 'Job created and enqueued' })
  @ApiResponse({ status: 404, description: 'Blueprint not found' })
  enqueue(
    @Param('blueprintId') blueprintId: string,
    @Body('selectedModels') selectedModels: string[],
  ) {
    console.log("SELECTED MODELS RECIVED: ", selectedModels)
    return this.inferenceJobService.enqueue(blueprintId, selectedModels);
  }

  @Get('inference-jobs/:id')
  @ApiOperation({ summary: 'Get inference job status and result' })
  @ApiParam({ name: 'id', description: 'Inference job ID' })
  @ApiResponse({ status: 200, description: 'Job found' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  findOne(@Param('id') id: string) {
    return this.inferenceJobService.findOne(id);
  }

  @Delete('inference-jobs/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel a pending or processing inference job' })
  @ApiParam({ name: 'id', description: 'Inference job ID' })
  @ApiResponse({ status: 204, description: 'Cancellation initiated' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 409, description: 'Job is already in a terminal status' })
  cancel(@Param('id') id: string) {
    return this.inferenceJobService.cancel(id);
  }

  @Get('availableModels')
  @ApiOperation({ summary: 'Get inference job available models per label' })
  @ApiResponse({ status: 200, description: 'Models obtained' })
  @ApiResponse({ status: 404, description: 'Models not found' })
  getAvailableModels(){
    return this.inferenceJobService.getAvailableModels()
  }

}
