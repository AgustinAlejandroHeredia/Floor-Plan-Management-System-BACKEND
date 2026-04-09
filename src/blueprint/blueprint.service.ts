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
import { FileStorageService, StoredFile } from 'src/file-storage/file-storage.service';
import { ThumbnailService } from 'src/thumbnail/thumbnail.service';

import { randomUUID } from "crypto";

@Injectable()
export class BlueprintService {
  constructor(
    @InjectModel(Blueprint.name)
    private blueprintModel: Model<BlueprintDocument>,
    private readonly storageService: FileStorageService,
    private readonly thumbnailService: ThumbnailService,
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

    // uploads it with unique name
    const uniqueName = `${randomUUID()}_${file.originalname}`;
    file.originalname = uniqueName

    const uploadedFile = await this.storageService.uploadFile(file);

    let uploadedThumbnail: StoredFile | null = null;

    try {

      // ---- THUMBNAIL ----
      const thumbnailBuffer = await this.thumbnailService.createThumbnail(file.buffer)
      const thumbnailOriginalname = this.thumbnailService.getThumbnailName(uploadedFile.name)

      const thumbnailFile: Express.Multer.File = {
        ...file,
        buffer: thumbnailBuffer,
        size: thumbnailBuffer.length,
        originalname: thumbnailOriginalname,
        mimetype: "image/jpeg"
      }

      uploadedThumbnail = await this.storageService.uploadFile(thumbnailFile)

      // ---- BLUEPRINT ----
      const blueprint = new this.blueprintModel({
        ...dto,
        projectId: new Types.ObjectId(dto.projectId),
        organizationId: new Types.ObjectId(dto.organizationId),
        uploadedBy: new Types.ObjectId(userId),
        storageId: uploadedFile.id,
        storageThumbnailId: uploadedThumbnail.id,
        filename: uploadedFile.name,
        encoding: file.encoding,
        mimetype: file.mimetype,
        size: file.size,
      });

      return await blueprint.save();
    } catch (error) {
      console.log("ERROR : ", error)
      // rollback
      if(uploadedFile){
        await this.storageService.deleteFile(uploadedFile.id);
      }
      if(uploadedThumbnail){
        await this.storageService.deleteFile(uploadedThumbnail.id)
      }
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

  // GET all thumbnails by project
  async findThumbnailsByProject(projectId: string) {
    const blueprints = await this.blueprintModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: -1 }) // order by date
      .lean();

    return Promise.all(
      blueprints.map(async (bp) => ({
        ...bp,
        downloadUrl: await this.storageService.getSignedDownloadUrl(
          this.thumbnailService.getThumbnailName(bp.filename)
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

    // original file
    await this.storageService.deleteFile(blueprint.storageId);

    // thumbnail
    await this.storageService.deleteFile(blueprint.storageThumbnailId)

    // db reg
    await this.blueprintModel.findByIdAndDelete(id);

    return { message: 'Blueprint eliminado correctamente' };
  }

  async getOldestBlueprintThumbnailUrl(projectId: string) {
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
      this.thumbnailService.getThumbnailName(blueprint.filename)
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