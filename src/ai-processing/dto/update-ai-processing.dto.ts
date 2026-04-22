import { PartialType } from '@nestjs/swagger';
import { CreateAiProcessingDto } from './create-ai-processing.dto';

export class UpdateAiProcessingDto extends PartialType(CreateAiProcessingDto) {}
