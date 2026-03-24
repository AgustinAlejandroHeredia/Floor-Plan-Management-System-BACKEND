import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';

@Controller('blueprint')
export class BlueprintController {
  constructor(private readonly blueprintService: BlueprintService) {}

  @Post()
  create(@Body() createBlueprintDto: CreateBlueprintDto) {
    return this.blueprintService.create(createBlueprintDto);
  }

  @Get()
  findAll() {
    return this.blueprintService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.blueprintService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBlueprintDto: UpdateBlueprintDto) {
    return this.blueprintService.update(+id, updateBlueprintDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blueprintService.remove(+id);
  }
}
