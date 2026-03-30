import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
} from '@nestjs/common';

import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationController {

  constructor(private readonly organizationService: OrganizationService) {}

  // CREATE
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'address', 'contactEmail', 'contactPhone', 'record'],
      properties: {
        name: { type: 'string', example: 'Acme Corp' },
        address: { type: 'string', example: '123 Main St, City, Country' },
        contactEmail: { type: 'string', example: 'contact@acme.com' },
        contactPhone: { type: 'string', example: '+541112345678' },
        record: { type: 'string', example: 'A1B2-2026-001' },
      },
    },
  })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  // GET ALL
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({ status: 200, description: 'Organizations list' })
  findAll() {
    return this.organizationService.findAll();
  }

  // GET ONE
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get organization by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization found' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  // UPDATE
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  // DELETE
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Organization deleted successfully' })
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }

}