import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blueprint, BlueprintDocument } from './schemas/blueprint.schema';
import { CreateBlueprintDto } from './dto/create-blueprint.dto';
import { UpdateBlueprintDto } from './dto/update-blueprint.dto';
import { FileStorageService, StoredFile } from 'src/file-storage/file-storage.service';
import { ThumbnailService } from 'src/thumbnail/thumbnail.service';

import { randomUUID } from "crypto";
import axios from 'axios';
import { UpdateSectionViewsDto } from './dto/update-section-views';
import { UserRole } from 'src/user/common/role.enum';
import { Organization, OrganizationDocument } from 'src/organization/schemas/organization.schema';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { Project, ProjectDocument } from 'src/project/schemas/project.schema';

@Injectable()
export class BlueprintService {
  constructor(
    @InjectModel(Blueprint.name)
    private blueprintModel: Model<BlueprintDocument>,
    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    @InjectModel(Project.name)
    private projectModel: Model<ProjectDocument>,
    private readonly storageService: FileStorageService,
    private readonly thumbnailService: ThumbnailService,
    private readonly organizationMembershipService: OrganizationMembershipService,
  ) {}

  // CREATE (upload + mongo)
  async create(
    file: Express.Multer.File,
    dto: CreateBlueprintDto,
    userId: string,
    userGlobalRole: string,
  ): Promise<Blueprint> {
    if (!file) {
      throw new BadRequestException('File required');
    }

    // user exists in the organization?
    const belongs = await this.organizationMembershipService.findByUserIdAndOrganizationId(userId, dto.organizationId)
    if(!belongs && userGlobalRole !== UserRole.SUPERADMIN){
      throw new ForbiddenException("Access denied, user does not belog to the organization")
    }

    const organization = await this.organizationModel.findById(new Types.ObjectId(dto.organizationId))
    if(!organization){
      throw new NotFoundException("Organization not found")
    }
    
    const organizationBlueprintsCount = await this.getBlueprintCountByOrganizationId(dto.organizationId, userId, userGlobalRole)
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

      const savedBlueprint = await blueprint.save();

      // updates original blueprint, crop was made from it
      if(dto.originalBlueprintId) {
        await this.blueprintModel.findByIdAndUpdate(
          dto.originalBlueprintId,
          {
            $push: {
              cropsMade: {
                blueprintId: savedBlueprint._id,
                blueprintName: savedBlueprint.blueprintName,
              }
            }
          }
        )
      }

      return savedBlueprint

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
      throw new InternalServerErrorException('Error creating blueprint');
    }
  }

  // GET ONE (mongo + backblaze)
  async findOne(
    id: string,
    userId: string,
    userGlobalRole: string,
  ) {
    const blueprint = await this.blueprintModel
      .findById(id, {titleBlock: 0})
      .lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    // user exists in the organization?
    const belongs = await this.organizationMembershipService.findByUserIdAndOrganizationId(userId, blueprint.organizationId.toString())
    if(!belongs && userGlobalRole !== UserRole.SUPERADMIN){
      throw new ForbiddenException("Access denied, user does not belog to the organization")
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename,
    )

    const project = await this.projectModel.findById(blueprint.projectId)

    const projectFields = {
      levels: project?.levels,
      basement: project?.basement,
    }

    const responseData: any = {
      ...blueprint,
      projectFields,
      downloadUrl,
    }

    if(blueprint.originalBlueprintId){
      const originalBlueprintName = (await this.blueprintModel
        .findOne(
          { _id: blueprint.originalBlueprintId },
          { blueprintName: 1, _id: 0 },
        )
        .lean()
      )?.blueprintName

      responseData.croppedFrom = originalBlueprintName
    }

    return responseData
  }

  // GET all thumbnails by project
  async findThumbnailsByProject(
    projectId: string,
    userId: string,
    userGlobalRole: string,
  ) {
    const blueprints = await this.blueprintModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: -1 }) // order by date
      .lean();

    if(blueprints.length === 0){
      return []
    }

    // user exists in the organization?
    let organizationId = ""
    organizationId = blueprints[0].organizationId.toString()
    await this.organizationMembershipService.validateOrganizationAccess(userId, organizationId.toString(), userGlobalRole)

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
  async update(
    id: string, 
    dto: UpdateBlueprintDto,
    userId: string,
    userGlobalRole: string,
  ) {
    
    const originalBlueprint = await this.blueprintModel.findById(new Types.ObjectId(id))
    
    if (!originalBlueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, originalBlueprint.organizationId.toString(), userGlobalRole)
    
    const updated = await this.blueprintModel.findByIdAndUpdate(
      id,
      dto,
      { new: true },
    );

    return updated;
  }

  // DELETE (backblaze + mongo)
  async remove(
    id: string,
    userId: string,
    userGlobalRole: string,
  ) {
    const blueprint = await this.blueprintModel
      .findById(id, {
        storageId: 1,
        storageThumbnailId: 1,
        originalBlueprintId: 1,
      })
      .lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

    // If this blueprint was a crop, remove from original blueprint
    if (blueprint.originalBlueprintId) {
      await this.blueprintModel.findByIdAndUpdate(
        blueprint.originalBlueprintId,
        {
          $pull: {
            cropsMade: {
              blueprintId: new Types.ObjectId(id),
            },
          },
        }
      );
    }

    // delete mongo doc
    await this.blueprintModel.findByIdAndDelete(id);

    // delete files
    const results = await Promise.allSettled([
      this.storageService.deleteFile(blueprint.storageId),
      this.storageService.deleteFile(blueprint.storageThumbnailId),
    ]);

    const failed = results.filter(r => r.status === 'rejected');

    return {
      message: 'Blueprint eliminado correctamente',
      warnings:
        failed.length > 0
          ? [`${failed.length} files could not be deleted from storage`]
          : [],
    };
  }

  async getOldestBlueprintThumbnailUrl(
    projectId: string,
    userId: string,
    userGlobalRole: string,
  ) {
    const blueprint = await this.blueprintModel
      .findOne({ projectId: new Types.ObjectId(projectId) })
      .sort({ creationDate: 1 })
      .lean();

    if (!blueprint) {
      throw new NotFoundException(
        `No blueprints found for project ${projectId}`
      );
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      this.thumbnailService.getThumbnailName(blueprint.filename)
    );

    return {
      downloadUrl,
    };
  }

  async getBlueprintDownloadUrlOnly(
    blueprintId,
    userId: string,
    userGlobalRole: string,
  ) {
    const blueprint = await this.blueprintModel.findById(blueprintId).lean();
    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

    const downloadUrl = await this.storageService.getSignedDownloadUrl(
      blueprint.filename,
    );

    return {
      downloadUrl,
    };
  }

  async getImageStream(
    id: string,
    userId: string,
    userGlobalRole: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
  }> {
    const blueprint = await this.blueprintModel.findById(id).lean();

    if (!blueprint) {
      throw new NotFoundException('Blueprint no encontrado');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

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

  async getBlueprintCountByOrganizationId(
    organizationId: string, 
    userId: string, 
    userGlobalRole: string,
  ): Promise<number> {

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, organizationId, userGlobalRole)
  
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

  async updateSectionViews(
    blueprintId: string,
    dto: UpdateSectionViewsDto,
    userId: string,
    userGlobalRole: string,
  ): Promise<BlueprintDocument> {

    const blueprint = await this.blueprintModel.findById(new Types.ObjectId(blueprintId))

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // user exists in the organization?
    await this.organizationMembershipService.validateOrganizationAccess(userId, blueprint.organizationId.toString(), userGlobalRole)

    const updatedblueprint =
      await this.blueprintModel.findByIdAndUpdate(
        new Types.ObjectId(blueprintId),
        {
          sectionViews: dto.sectionViews,
        },
        {
          new: true,
        },
      );

    if (!updatedblueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    return updatedblueprint;
  }

  async getUserUploads(
    userId: string,
    userGlobalRole: string,
  ) {
    const userObjectId = new Types.ObjectId(userId);

    // 1. blueprints
    const blueprints = await this.blueprintModel
      .find({ uploadedBy: userObjectId })
      .sort({ creationDate: -1 })
      .lean()

    if (!blueprints.length) return []

    // 2. organizations
    const organizationIds = [
      ...new Set(blueprints.map(bp => bp.organizationId.toString())),
    ]

    // ACCESS CHECK
    await Promise.all(
      organizationIds.map((orgId) =>
        this.organizationMembershipService.validateOrganizationAccess(
          userId,
          orgId,
          userGlobalRole,
        ),
      ),
    )

    const organizations = await this.organizationModel.find(
      { _id: { $in: organizationIds } },
      { name: 1 },
    )

    const organizationMap = new Map(
      organizations.map(org => [org._id.toString(), org.name]),
    )

    // 3. response
    return Promise.all(
      blueprints.map(async (bp) => ({
        _id: bp._id.toString(),
        blueprintName: bp.blueprintName,
        filename: bp.filename,
        creationDate: bp.creationDate,
        organizationId: bp.organizationId.toString(),
        organizationName:
          organizationMap.get(bp.organizationId.toString()) ?? "undefined",

        processed: (bp.sectionViews?.length ?? 0) > 0,

        thumbnailUrl: await this.storageService.getSignedDownloadUrl(
          this.thumbnailService.getThumbnailName(bp.filename),
        ),
      })),
    )
  }

  async getBlueprintProjectInfo(
    blueprintId: string,
    userId: string,
    userGlobalRole: string,
  ): Promise<{
    projectId: string;
    projectName: string;
  }> {

    const blueprint = await this.blueprintModel.findById(
      new Types.ObjectId(blueprintId),
    );

    if (!blueprint) {
      throw new NotFoundException('Blueprint not found');
    }

    // Validar acceso a la organización
    await this.organizationMembershipService.validateOrganizationAccess(
      userId,
      blueprint.organizationId.toString(),
      userGlobalRole,
    );

    const project = await this.projectModel.findById(
      blueprint.projectId,
      {
        projectName: 1,
      }
    )

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      projectId: project._id.toString(),
      projectName: project.projectName,
    };
  }
}