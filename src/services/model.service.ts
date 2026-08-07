import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

const MODELS_FILE = path.join(process.cwd(), 'src', 'data', 'models.json');
const TEMP_MODELS_FILE = path.join(process.cwd(), 'src', 'data', 'models.json.tmp');

@Injectable()
export class ModelService {
  private async readFile(): Promise<any> {
    try {
      const raw = await fs.readFile(MODELS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      throw new InternalServerErrorException('Unable to read models.json');
    }
  }

  private async writeFile(payload: any) {
    try {
      await fs.writeFile(TEMP_MODELS_FILE, JSON.stringify(payload, null, 2), 'utf8');
      await fs.rename(TEMP_MODELS_FILE, MODELS_FILE);
    } catch (error) {
      throw new InternalServerErrorException('Unable to persist models.json');
    }
  }

  async getAllModels() {
    const data = await this.readFile();
    return data.models ?? [];
  }

  async getModelById(id: string) {
    const models = await this.getAllModels();
    const found = models.find((model) => model.id === id);
    if (!found) {
      throw new NotFoundException('Model not found');
    }
    return found;
  }

  async addModel(model: any) {
    const models = await this.getAllModels();
    if (models.some((entry) => entry.id === model.id)) {
      throw new ConflictException('Model with this id already exists');
    }
    models.push(model);
    await this.writeFile({ models });
    return model;
  }

  async updateModel(id: string, update: any) {
    const models = await this.getAllModels();
    const index = models.findIndex((model) => model.id === id);
    if (index === -1) {
      throw new NotFoundException('Model not found');
    }
    const updated = { ...models[index], ...update };
    models[index] = updated;
    await this.writeFile({ models });
    return updated;
  }

  async deleteModel(id: string) {
    const models = await this.getAllModels();
    const index = models.findIndex((model) => model.id === id);
    if (index === -1) {
      throw new NotFoundException('Model not found');
    }
    const [deleted] = models.splice(index, 1);
    await this.writeFile({ models });
    return deleted;
  }
}
