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
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlueprintService } from './blueprint.service';
import { InferenceJobService } from 'src/inference-job/inference-job.service';
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
import { UpdateSectionViewsDto } from './dto/update-section-views';
import { AccessGuard } from 'src/auth/guards/access.guard';
import { UserRoles } from 'src/auth/decorators/user-roles.decorator';
import { UserRole } from 'src/user/common/role.enum';

@ApiTags('Blueprints')
@ApiBearerAuth('access-token')
@Controller('blueprints')
export class BlueprintController {
  constructor(
    private readonly blueprintService: BlueprintService,
    private readonly inferenceJobService: InferenceJobService,
  ) {}

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
      req.user.globalRole,
    );
  }

  // GET latest processed inference job for a blueprint
  @Get(':blueprintId/inference-jobs/latest')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the latest processed inference job for a blueprint' })
  @ApiParam({ name: 'blueprintId', type: String })
  @ApiResponse({ status: 200, description: 'Latest processed inference job, or null' })
  getLatestInferenceJob(@Param('blueprintId') blueprintId: string) {
    return this.inferenceJobService.findLatestProcessedForBlueprint(blueprintId);
  }

  // GET ONE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprint by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint obtained' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getOne(
    @Req() req,
    @Param('id') id: string
  ) {
    return this.blueprintService.findOne(id, req.user.internalId, req.user.globalRole);
  }

  // GET all thumbnailss by project
  @Get('/projectThumbnails/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all blueprint thumnails by project id' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprints list' })
  findThumbnailsByProject(
    @Req() req,
    @Param('projectId') projectId: string
  ) {
    return this.blueprintService.findThumbnailsByProject(projectId, req.user.internalId, req.user.globalRole);
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
    @Req() req,
  ) {
    return this.blueprintService.update(id, dto, req.user.internalId, req.user.globalRole);
  }

  // DELETE
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete blueprint' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint deleted successfully' })
  remove(
    @Param('id') id: string,
    @Req() req,
  ) {
    return this.blueprintService.remove(id, req.user.internalId, req.user.globalRole);
  }

  // GET OLDEST BLUEPRINT
  @Get('/oldestBlueprintThumbnailUrl/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get oldest blueprint created' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint file url obtained successfully' })
  getOldestBlueprintUrl(
    @Param('projectId') projectId,
    @Req() req,
  ){
    return this.blueprintService.getOldestBlueprintThumbnailUrl(projectId, req.user.internalId, req.user.globalRole)
  }

  // GET BLUEPRINT DOWNLOAD URL ONLY
  @Get('/blueprintDownloadUrl/:blueprintId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get file download url only' })
  @ApiParam({ name: 'blueprintId', type: String })
  @ApiResponse({ status: 200, description: 'Blueprint file url obtained successfully' })
  getBlueprintDownloadUrlOnly(
    @Param('blueprintId') blueprintId,
    @Req() req,
  ){
    return this.blueprintService.getBlueprintDownloadUrlOnly(blueprintId, req.user.userId, req.user.globalRole)
  }

  // GET RAW IMAGE FOR BLUEPRINT VIEW AND CROP
  @Get(':id/image')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get blueprint image (stream)' })
  @ApiParam({ name: 'id', type: String })
  async getImage(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req,
  ) {
    const { stream, contentType } =
      await this.blueprintService.getImageStream(id, req.user.internalId, req.user.globalRole);

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
    @Req() req,
  ){
    return await this.blueprintService.getBlueprintCountByOrganizationId(organizationId, req.user.internalId, req.user.globalRole)
  }

  @Get('/counts/:organizationIds')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @UserRoles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get blueprint count for the provided organization ids' })
  @ApiParam({ name: 'organizationId', type: String })
  async getBlueprintCountsByOrganizationIds(
    @Param('organizationIds') organizationIds: string[],
  ){
    return await this.blueprintService.getBlueprintCountsByOrganizationIds(organizationIds)
  }

  @Patch(':id/section-views')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Updates the section view list. Adds all the new elements and the already existing ones' })
  @ApiParam({ name: 'blueprintId', type: String })
  async updateSectionViews(
    @Param('id') blueprintId: string,
    @Body() dto: UpdateSectionViewsDto,
    @Req() req,
  ) {
    const blueprint =
      await this.blueprintService.updateSectionViews(
        blueprintId,
        dto,
        req.user.internalId,
        req.user.globalRole,
      );

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    return blueprint;
  }

}