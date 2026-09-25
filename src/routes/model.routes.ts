import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { AccessGuard } from 'src/auth/guards/access.guard';
import { UserRoles } from 'src/auth/decorators/user-roles.decorator';
import { UserRole } from 'src/user/common/role.enum';
import { ModelService } from 'src/services/model.service';

@ApiTags('Model Registry')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('api/admin/models')
export class ModelRoutes {
  constructor(private readonly modelService: ModelService) {}

  @Get()
  async findAll() {
    return { models: await this.modelService.getAllModels() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { model: await this.modelService.getModelById(id) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('configFile'))
  async create(@Body('model') model: string, @Body() body: any, @UploadedFile() configFile?: Express.Multer.File) {
    return { model: await this.modelService.addModel(this.parseModel(model, body), configFile) };
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('configFile'))
  async update(@Param('id') id: string, @Body('model') model: string, @Body() body: any, @UploadedFile() configFile?: Express.Multer.File) {
    return { model: await this.modelService.updateModel(id, this.parseModel(model, body), configFile) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return { deleted: await this.modelService.deleteModel(id) };
  }

  private parseModel(model: string | undefined, body: any): any {
    if (model) return JSON.parse(model);
    return body;
  }
}
