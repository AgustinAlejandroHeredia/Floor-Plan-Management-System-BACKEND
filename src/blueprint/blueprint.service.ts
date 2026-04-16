import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blueprint, BlueprintDocument } from './schemas/blueprint.schema';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';
import { FileStorageService, StoredFile } from 'src/file-storage/file-storage.service';
import { ThumbnailService } from 'src/thumbnail/thumbnail.service';
import { OrganizationService } from 'src/organization/organization.service';

import { randomUUID } from "crypto";
import axios from 'axios';

@Injectable()
export class BlueprintService {
  constructor(
    @InjectModel(Blueprint.name)
    private blueprintModel: Model<BlueprintDocument>,
    private readonly storageService: FileStorageService,
    private readonly thumbnailService: ThumbnailService,
    private readonly organizationService: OrganizationService
  ) {}

  // CREATE (upload + mongo)
  async create(
    file: Express.Multer.File,
    dto: CreateBlueprintDto,
    userId: string,
  ): Promise<Blueprint> {
    if (!file) {
      throw new InternalServerErrorException('File required');
    }

    const organization = await this.organizationService.findOne(dto.organizationId)
    const organizationBlueprintsCount = await this.getBlueprintCountByOrganizationId(dto.organizationId)
    if(organizationBlueprintsCount+1 > Number(organization.maxBlueprints)){
      throw new BadRequestException(
        'Maximum organization blueprint count reached, cannot upload this file.'
      )
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

        ...(dto.originalBlueprintId && {
          originalBlueprintId: new Types.ObjectId(dto.originalBlueprintId),
        }),
      });

      return await blueprint.save();
    } catch (error) {
      console.log("ERROR : ", error)
      // rollback
      try {
        if(uploadedFile){
          await this.storageService.deleteFile(uploadedFile.id);
        }
        if(uploadedThumbnail){
          await this.storageService.deleteFile(uploadedThumbnail.id)
        }
      } catch (error) {
        console.error("Rollback failed : ", error)
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
    )

    if(blueprint.originalBlueprintId){
      const originalBlueprintName = (await this.blueprintModel
        .findOne(
          { _id: blueprint.originalBlueprintId },
          { blueprintName: 1, _id: 0 },
        )
        .lean()
      )?.blueprintName

      return {
        ...blueprint,
        downloadUrl,
        croppedFrom: originalBlueprintName,
      }
    }

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
    const blueprint = await this.blueprintModel
      .findById(id, {
        storageId: 1,
        storageThumbnailId: 1,
      })
      .lean()

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    // db reg
    await this.blueprintModel.findByIdAndDelete(id);

    // blueprints y thumbnails
    const results = await Promise.allSettled([
      this.storageService.deleteFile(blueprint.storageId),
      this.storageService.deleteFile(blueprint.storageThumbnailId),
    ]);

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error(`Failed to delete ${failed.length} files for blueprint ${id}`);
    }

    return {
      message: 'Blueprint eliminado correctamente',
      warnings:
        failed.length > 0
          ? [`${failed.length} files could not be deleted from storage`]
          : [],
    };
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

  async getImageStream(id: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
  }> {
    const blueprint = await this.blueprintModel.findById(id).lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename,
    );

    // pedimos la imagen como stream
    const response = await axios.get(signedUrl, {
      responseType: 'stream',
    });

    return {
      stream: response.data,
      contentType: response.headers['content-type'] || 'image/png',
    };
  }

  async getBlueprintCountByOrganizationId(organizationId: string): Promise<number> {
      return await this.blueprintModel.countDocuments({
        organizationId: new Types.ObjectId(organizationId)
      })
  }

  async getBlueprintCountsByOrganizationIds(
    organizationIds: string[] | string,
  ): Promise<{ organizationId: string; count: number }[]> {

    const idsArray =
      Array.isArray(organizationIds)
        ? organizationIds
        : typeof organizationIds === 'string'
          ? organizationIds.split(',')
          : [];

    if (idsArray.length === 0) {
      throw new BadRequestException('organizationIds is required');
    }

    const objectIds = idsArray.map(
      (id) => new Types.ObjectId(id),
    );

    const results = await this.blueprintModel.aggregate([
      {
        $match: {
          organizationId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: '$organizationId',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          organizationId: '$_id',
          count: 1,
        },
      },
    ]);

    return results;
  }


  async getAllBlueprintsByProjectId(projectId: string): Promise<BlueprintDocument[]> {
    const blueprints = await this.blueprintModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: 1 })
    return blueprints
  }

  // use-case/delete-project
  async deleteBlueprintsByProjectId(projectId: string): Promise<void> {
    if(!projectId){
      throw new BadRequestException('ProjectId is required');
    }
    const objectId = new Types.ObjectId(projectId)
    await this.blueprintModel.deleteMany({
      projectId: objectId
    })
  }

  // use-case/delete-organization
  async deleteBlueprintsByManyProjectIds(projectIds: string[]): Promise<void> {
    if(!projectIds || projectIds.length === 0){
      throw new BadRequestException('ProjectIds is required');
    }
    const objectIds = projectIds.map(id => new Types.ObjectId(id));
    await this.blueprintModel.deleteMany({
      projectId: { $in: objectIds }
    })
  }

  // use-case/delete-project
  async getAllStorageIdsByProjectId(projectId: string): Promise<string[]> {
    if(!projectId){
      throw new BadRequestException('projectId is required');
    }

    const objectId = new Types.ObjectId(projectId)

    const results = this.blueprintModel
      .find(
        { projectId: objectId },
        { storageId: 1, _id: 0 }
      )
      .lean()
    
    return (await results).map(s => s.storageId)
  }

  // use-case/delete-organization
  async getAllSotrageIdsByManyProjectIds(projectIds: string[]): Promise<string[]> {
    if(!projectIds || projectIds.length === 0){
      throw new BadRequestException('projectIds is required');
    }

    const objectIds = projectIds.map(id => new Types.ObjectId(id));

    const results = await this.blueprintModel
      .find(
        { projectId: { $in: objectIds } },
        { storageId: 1, _id: 0 },
      )
      .lean()

    return results.map(s => s.storageId)
  }
}