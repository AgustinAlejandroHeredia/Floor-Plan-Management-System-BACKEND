import { Injectable } from '@nestjs/common';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';

@Injectable()
export class BlueprintService {
  create(createBlueprintDto: CreateBlueprintDto) {
    return 'This action adds a new blueprint';
  }

  findAll() {
    return `This action returns all blueprint`;
  }

  findOne(id: number) {
    return `This action returns a #${id} blueprint`;
  }

  update(id: number, updateBlueprintDto: UpdateBlueprintDto) {
    return `This action updates a #${id} blueprint`;
  }

  remove(id: number) {
    return `This action removes a #${id} blueprint`;
  }
}
