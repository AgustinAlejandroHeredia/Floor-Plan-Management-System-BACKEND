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

  // GET all thumbnailss by project
  @Get('/projectThumbnails/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all blueprint thumnails by project id' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprints list' })
  findThumbnailsByProject(@Param('projectId') projectId: string) {
    return this.blueprintService.findThumbnailsByProject(projectId);
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
  @Get('/oldestBlueprintThumbnailUrl/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get oldest blueprint created' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint file url obtained successfully' })
  getOldestBlueprintUrl(
    @Param('projectId') projectId,
  ){
    return this.blueprintService.getOldestBlueprintThumbnailUrl(projectId)
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

  // GET RAW IMAGE FOR BLUEPRINT VIEW AND CROP
  @Get(':id/image')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprint image (stream)' })
  @ApiParam({ name: 'id', type: String })
  async getImage(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, contentType } =
      await this.blueprintService.getImageStream(id);

    res.set({
      'Content-Type': contentType,
    });

    stream.pipe(res);
  }

  @Get('/count/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprint count for the provided organization id' })
  @ApiParam({ name: 'organizationId', type: String })
  async getBlueprintCountByOrganizationId(
    @Param('organizationId') organizationId: string,
  ){
    return await this.blueprintService.getBlueprintCountByOrganizationId(organizationId)
  }

}