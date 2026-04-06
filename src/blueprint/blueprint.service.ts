import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blueprint, BlueprintDocument } from './schemas/blueprint.schema';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';
import { FileStorageService } from 'src/file-storage/file-storage.service';

@Injectable()
export class BlueprintService {
  constructor(
    @InjectModel(Blueprint.name)
    private blueprintModel: Model<BlueprintDocument>,
    private readonly storageService: FileStorageService,
  ) {}

  // CREATE (upload + mongo)
  async create(
    file: Express.Multer.File,
    dto: CreateBlueprintDto,
    userId: string,
  ): Promise<Blueprint> {
    if (!file) {
      throw new InternalServerErrorException('Archivo requerido');
    }

    const uploaded = await this.storageService.uploadFile(file);

    try {
      const blueprint = new this.blueprintModel({
        ...dto,
        projectId: new Types.ObjectId(dto.projectId),
        organizationId: new Types.ObjectId(dto.organizationId),
        uploadedBy: new Types.ObjectId(userId),
        storageId: uploaded.id,
        filename: uploaded.name,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
      });

      return await blueprint.save();
    } catch (error) {
      console.log("ERROR : ", error)
      await this.storageService.deleteFile(uploaded.id);
      throw new InternalServerErrorException('Error creando blueprint');
    }
  }

  // GET ONE (mongo + backblaze)
  async findOne(id: string) {
    const blueprint = await this.blueprintModel.findById(id).lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename,
    );

    return {
      ...blueprint,
      downloadUrl,
    };
  }

  // GET by project
  /*
  async findByProject(projectId: string) {
    return this.blueprintModel.find({ projectId }).lean();
  }
  */
  async findByProject(projectId: string) {
    const blueprints = await this.blueprintModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: -1 }) // order by date
      .lean();

    return Promise.all(
      blueprints.map(async (bp) => ({
        ...bp,
        downloadUrl: await this.storageService.getSignedDownloadUrl(
          bp.filename
        ),
      }))
    );
  }

  // GET by user
  async findByUser(userId: string) {
    return this.blueprintModel.find({ uploadedBy: userId }).lean();
  }

  // UPDATE
  async update(id: string, dto: UpdateBlueprintDto) {
    const updated = await this.blueprintModel.findByIdAndUpdate(
      id,
      dto,
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    return updated;
  }

  // DELETE (backblaze + mongo)
  async remove(id: string) {
    const blueprint = await this.blueprintModel.findById(id);

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    await this.storageService.deleteFile(blueprint.storageId);

    await this.blueprintModel.findByIdAndDelete(id);

    return { message: 'Blueprint eliminado correctamente' };
  }

  async getOldestBlueprintUrl(projectId: string) {
    const blueprint = await this.blueprintModel
      .findOne({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: 1 })
      .lean();

    if (!blueprint) {
      throw new NotFoundException(
        `No blueprints found for project ${projectId}`
      );
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename
    );

    return {
      downloadUrl,
    };
  }

  async getBlueprintDownloadUrlOnly(blueprintId) {
    const blueprint = await this.blueprintModel.findById(blueprintId).lean();
    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename,
    );

    return {
      downloadUrl,
    };
  }
}