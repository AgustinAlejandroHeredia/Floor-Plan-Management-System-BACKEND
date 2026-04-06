import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  Patch,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlueprintService } from './blueprint.service';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import type { Response } from 'express';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Blueprints')
@ApiBearerAuth('access-token')
@Controller('blueprints')
export class BlueprintController {
  constructor(private readonly blueprintService: BlueprintService) {}

  // CREATE
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files allowed'), false);
      }
      cb(null, true);
    },
  }))
  @ApiOperation({ summary: 'Upload blueprint (mongo & file)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'blueprintName', 'projectId', 'organizationId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        blueprintName: { type: 'string' },
        projectId: { type: 'string' },
        organizationId: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateBlueprintDto,
    @Req() req,
  ) {
    return this.blueprintService.create(
      file,
      dto,
      req.user.internalId,
    );
  }

  // GET ONE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprint by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint obtained' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getOne(@Param('id') id: string) {
    return this.blueprintService.findOne(id);
  }

  // GET by project
  @Get('/project/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprints by project id' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprints list' })
  findByProject(@Param('projectId') projectId: string) {
    return this.blueprintService.findByProject(projectId);
  }

  // GET my files
  @Get('/me/files')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get file from auth user request' })
  @ApiResponse({ status: 200, description: 'Users file list' })
  findMyFiles(@Req() req) {
    return this.blueprintService.findByUser(req.user.internalId);
  }

  // UPDATE
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar un blueprint' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlueprintDto,
  ) {
    return this.blueprintService.update(id, dto);
  }

  // DELETE
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete blueprint' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint deleted successfully' })
  remove(@Param('id') id: string) {
    return this.blueprintService.remove(id);
  }

  // GET OLDEST BLUEPRINT
  @Get('/oldestBlueprintUrl/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get oldest blueprint created' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint file url obtained successfully' })
  getOldestBlueprintUrl(
    @Param('projectId') projectId,
  ){
    return this.blueprintService.getOldestBlueprintUrl(projectId)
  }

  // GET BLUEPRINT DOWNLOAD URL ONLY
  @Get('/blueprintDownloadUrl/:blueprintId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get file download url only' })
  @ApiParam({ name: 'blueprintId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint file url obtained successfully' })
  getBlueprintDownloadUrlOnly(
    @Param('blueprintId') blueprintId,
  ){
    return this.blueprintService.getBlueprintDownloadUrlOnly(blueprintId)
  }

}