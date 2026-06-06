import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMembershipService } from 'src/project_membership/project_membership.service';
import { ProjectRole } from 'src/user/common/role.enum';
import { ProjectStatus } from 'src/project/common/status.enum';
import { Blueprint, BlueprintDocument } from 'src/blueprint/schemas/blueprint.schema';
import { Organization, OrganizationDocument } from 'src/organization/schemas/organization.schema';
import { ProjectUserList } from './common/types';
import { OrganizationService } from 'src/organization/organization.service';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActionType } from 'src/activity-logs/common/types';
import { BlueprintService } from 'src/blueprint/blueprint.service';

@Injectable()
export class ProjectService {


  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private readonly organizationMembershipService: OrganizationMembershipService,
    private readonly projectMembershipService: ProjectMembershipService,
    @InjectModel(Blueprint.name) private blueprintModel: Model<BlueprintDocument>,
    @InjectModel(Organization.name) private organizationModel: Model<OrganizationDocument>,
    private readonly organizationService: OrganizationService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly blueprintService: BlueprintService,
  ) {}


  // CREATE
  async create(
    dto: CreateProjectDto,
    creatorUserId: string,
    organizationId: string,
  ): Promise<Project> {

    // Check for permissions
    const myOrganizationRole = await this.organizationService.myOrganizationRole(creatorUserId, organizationId)
    const organizationPermissions = await this.organizationService.getOrganizationActionPermissions(organizationId)
    if(myOrganizationRole.toLowerCase() !== organizationPermissions.createPermission.toLowerCase()){
      throw new ForbiddenException("access denied")
    }

    // Create project
    const createdProject = new this.projectModel({
      ...dto,
      status: ProjectStatus.PENDING,
      creatorUserId: new Types.ObjectId(creatorUserId),
      organizationId: new Types.ObjectId(organizationId),
      customFields: dto.customFields || {},
    })

    const savedProject = await createdProject.save();

    // Create projectMembership for the created project
    try {

      await this.projectMembershipService.create({
        userId: creatorUserId,
        projectId: savedProject._id.toString(),
        projectRole: ProjectRole.CREATOR, // assigns creator role to this user for this project
        organizationId, // for check
      })

      // ACTIVITY LOG
      this.activityLogsService.create(creatorUserId, {
        action: ActionType.CREATE_PROJECT,
        description: `Project created with the name "${savedProject.projectName}".`,
        targetName: `${savedProject.projectName}`,
        targetId: `${savedProject._id}`
      })

    } catch (error) {

      // rollback
      await this.projectModel.findByIdAndDelete(savedProject._id)

      throw new InternalServerErrorException('Error creating project membership for the creator')
    }

    return savedProject;
  }


  // GET ALL
  async findAll(): Promise<Project[]> {
    return this.projectModel.find().lean()
  }


  // GET ONE WITH VERIFICATION
  async findOneWithVerification(
    projectId: string,
    userId: string,
    userGlobalRole: string,
  ): Promise<Project> {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('Project not found')
    
    const project = await this.projectModel.findById(projectId).lean()
    if (!project) throw new NotFoundException('Project not found')

    const organizationId = project.organizationId.toString()

    await this.organizationMembershipService.validateOrganizationAccess(userId, organizationId, userGlobalRole)

    return project
  }


  // GET ONE
  async findOne(
    projectId: string,
  ): Promise<Project> {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('Project not found')
    
    const project = await this.projectModel.findById(projectId).lean()
    if (!project) throw new NotFoundException('Project not found')

    return project
  }

  // UPDATE
  async update(
    projectId: string, 
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<Project> {

    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('Project not found')
    
    const project = await this.projectModel.findById(new Types.ObjectId(projectId))
    if(!project) throw new NotFoundException('Project not found')

    // Check for permissions - edit permission comes from creation permission from organization
    const myOrganizationRole = await this.organizationService.myOrganizationRole(userId, project.organizationId.toString())
    const organizationPermissions = await this.organizationService.getOrganizationActionPermissions(project.organizationId.toString())
    if(myOrganizationRole.toLowerCase() !== organizationPermissions.createPermission.toLowerCase()){
      throw new ForbiddenException("access denied")
    }
    
    const updated = await this.projectModel.findByIdAndUpdate(
      projectId,
      dto,
      { new: true, runValidators: true }
    ).lean()
    if (!updated) throw new NotFoundException('Project not found')

    // ACTIVITY LOG
    this.activityLogsService.create(userId, {
      action: ActionType.EDIT_PROJECT,
      description: `Project edited with the name "${updated.projectName}".`,
      targetName: `${updated.projectName}`,
      targetId: `${updated._id}`
    })

    return updated
  }


  // CHANGE USER ROLE BY USER + PROJECT
  async changeUserRoleByUserAndProject(
    userId: string,
    projectId: string,
    newRole: ProjectRole,
  ): Promise<boolean> {

    try {
      // 1. Buscar el membership existente
      const membership = await this.projectMembershipService.findByUserIdAndProjectId(
        userId,
        projectId,
      ).catch(() => null)

      if(!membership) return false

      // 2. Actualizar el rol
      await this.projectMembershipService.updateRole(membership._id.toString(), { projectRole: newRole });

      return true
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Membership no existe
        return false;
      }
      // Otros errores se pueden propagar o también devolver false
      return false
    }
  }


  // DELETE
  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Project not found');
    const result = await this.projectModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Project not found');
    return { deleted: true };
  }


  // DELETE USER FROM PROJECT
  async deleteUserFromProject(
    userId: string,
    projectId: string,
  ): Promise<void>{
    await this.projectMembershipService.deleteByUserAndProject(userId, projectId)
  }


  // ADD USER TO PROJECT
  async addUser(userId: string, projectId: string): Promise<boolean> {
    try {

      const project = await this.projectModel
        .findById(projectId)
        .select('organizationId')
        .lean()

      if(!project) throw new NotFoundException('Project not found');

      await this.projectMembershipService.create({
        userId,
        projectId,
        projectRole: ProjectRole.VIEWER,
        organizationId: project.organizationId.toString()
      });

      return true;

    } catch (error: any) {
      if (error.code === 11000) return false
      throw new InternalServerErrorException('Error when adding user')
    }
  }


  // MY PROJECTs BY oganizationId
  async projectsByUserAndOrganization(
    organizationId: string,
    userId: string,
  ): Promise<Project[]> {
    // Obtener todas las memberships del usuario
    const memberships = await this.projectMembershipService.findByUserId(userId)

    if(memberships.length === 0) return []

    // Extraer solo los projectId
    const projectIds = memberships.map(m => m.projectId)

    if (projectIds.length === 0) return []; // Si no tiene memberships, retorno vacío

    // Buscar proyectos de esos IDs que además pertenezcan a la organización
    const projects = await this.projectModel
      .find({
        _id: { $in: projectIds },
        organizationId: new Types.ObjectId(organizationId),
      })
      .lean()

    return projects
  }


  // ALL PROJECTS BY organizationId
  async getAllProjectsByOrganizationId(
    organizationId: string,
    page: number,
    limit: number,
    userId: string,
    userGlobalRole: string,
  ) {

    const skip = (page - 1) * limit;

    const filter = {
      organizationId: new Types.ObjectId(
        organizationId,
      ),
    };

    const [projects, totalItems] =
      await Promise.all([
        this.projectModel
          .find(filter)
          .sort({
            projectName: 1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        this.projectModel.countDocuments(
          filter,
        ),
      ]);

    const projectsWithThumbnail =
      await Promise.all(
        projects.map(async (project) => {

          let oldestBlueprintThumbnailUrl = '';

          try {
              const result = await this.blueprintService.getOldestBlueprintThumbnailUrl(
                project._id.toString(),
                userId,
                userGlobalRole,
              );
              oldestBlueprintThumbnailUrl = result.downloadUrl
          } catch {
            oldestBlueprintThumbnailUrl = '';
          }

          return {
            ...project,
            oldestBlueprintThumbnailUrl,
          };
        }),
      );

    return {
      list: projectsWithThumbnail,

      page,
      limit,

      totalItems,

      totalPages: Math.ceil(
        totalItems / limit,
      ),
    };
  }


  // GET MY PROJECT ROLE
  async myProjectRole(
    userId: string,
    projectId: string,
  ): Promise<string> {
    return this.projectMembershipService.getUserRole(userId, projectId);
  }


  // only used when deletes user from organizations, ProjectDocument is necesary
  async findByOrganizationId(organizationId: string): Promise<ProjectDocument[]> {
    return this.projectModel.find({
      organizationId: new Types.ObjectId(organizationId)
    })
  }

  // use-case/delete_organization
  async deleteAllProjectsByOrganizationId(organizationId: string): Promise<void> {
    if(!organizationId){
      throw new BadRequestException('organizationId is required');
    }
    await this.projectModel.deleteMany({
      organizationId: new Types.ObjectId(organizationId)
    })
  }

  // GET ALL PROJECTS WHERE THE USER HAS PARTICIPATED
  async getUserProjects(userId: string): Promise<ProjectUserList[]> {

    const userObjectId = new Types.ObjectId(userId)

    const uploads = await this.blueprintModel.countDocuments({
      uploadedBy: userObjectId,
    })

    const projectIds = await this.blueprintModel.distinct(
      'projectId',
      {
        uploadedBy: userObjectId,
      },
    )

    const projects = await this.projectModel.find(
      {
        _id: { $in: projectIds },
      },
      {
        projectName: 1,
        status: 1,
        organizationId: 1,
      },
    )

    const organizationIds = [
      ...new Set(
        projects.map(project => project.organizationId.toString())
      ),
    ]

    const organizations = await this.organizationModel.find(
      {
        _id: { $in: organizationIds },
      },
      {
        name: 1,
      },
    )

    const organizationMap = new Map(
      organizations.map(org => [
        org._id.toString(),
        org.name,
      ])
    )

    return projects.map(project => ({
      _id: project._id.toString(),
      projectName: project.projectName,
      status: project.status,
      uploads,
      organizationId: project.organizationId.toString(),
      organizationName:
        organizationMap.get(project.organizationId.toString()) ?? "",
    }))
  }
}
