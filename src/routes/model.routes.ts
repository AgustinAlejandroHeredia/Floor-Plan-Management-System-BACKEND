import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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

  @UserRoles(UserRole.SUPERADMIN)
  @Post()
  async create(@Body() body: any) {
    return { model: await this.modelService.addModel(body) };
  }

  @UserRoles(UserRole.SUPERADMIN)
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return { model: await this.modelService.updateModel(id, body) };
  }

  @UserRoles(UserRole.SUPERADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return { deleted: await this.modelService.deleteModel(id) };
  }
}
