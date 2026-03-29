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
      required: ['file', 'filename', 'projectId', 'organizationId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        filename: { type: 'string' },
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
  async getOne(@Param('id') id: string, @Res() res: Response) {
    const blueprint = await this.blueprintService.findOne(id);

    const file = blueprint.file;

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.name}"`,
    });

    res.send(file.buffer);
  }

  // GET by project
  @Get('/project/:projectId')
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
}