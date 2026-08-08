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

  private getDefaultKey(model: any) {
    const specialty = model?.AEC_speciality ?? '';
    const task = model?.task ?? '';
    return [task, specialty].filter(Boolean).join(':').trim();
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

    const normalizedModel = { ...model };
    if (normalizedModel.defaultModel) {
      const defaultKey = this.getDefaultKey(normalizedModel);
      normalizedModel.defaultFor = defaultKey || undefined;
      for (const entry of models) {
        if (this.getDefaultKey(entry) === defaultKey) {
          entry.defaultModel = false;
          delete entry.defaultFor;
        }
      }
    }

    models.push(normalizedModel);
    await this.writeFile({ models });
    return normalizedModel;
  }

  async updateModel(id: string, update: any) {
    const models = await this.getAllModels();
    const index = models.findIndex((model) => model.id === id);
    if (index === -1) {
      throw new NotFoundException('Model not found');
    }

    const updated = { ...models[index], ...update };
    const shouldSetAsDefault = Boolean(updated.defaultModel);

    if (shouldSetAsDefault) {
      const defaultKey = this.getDefaultKey(updated);
      updated.defaultFor = defaultKey || undefined;
      for (const entry of models) {
        if (entry.id !== updated.id && this.getDefaultKey(entry) === defaultKey) {
          entry.defaultModel = false;
          delete entry.defaultFor;
        }
      }
    } else {
      delete updated.defaultFor;
    }

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
