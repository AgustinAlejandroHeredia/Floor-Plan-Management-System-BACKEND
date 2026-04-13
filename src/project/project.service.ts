import { BadRequestException, forwardRef, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMembershipService } from 'src/project_membership/project_membership.service';
import { ProjectRole } from 'src/common/role.enum';
import { ProjectStatus } from 'src/common/status.enum';

@Injectable()
export class ProjectService {


  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @Inject(forwardRef(() => ProjectMembershipService))
    private readonly projectMembershipService: ProjectMembershipService,
  ) {}


  // CREATE
  async create(
    dto: CreateProjectDto,
    userId: string,
    organizationId: string,
  ): Promise<Project> {

    // Crear el proyecto
    const createdProject = new this.projectModel({
      ...dto,
      status: ProjectStatus.PENDING,
      creatorUserId: new Types.ObjectId(userId),
      organizationId: new Types.ObjectId(organizationId),
    });

    const savedProject = await createdProject.save();

    // Crear el ProjectMembership para el usuario que creó el proyecto
    try {

      await this.projectMembershipService.create({
        userId: userId,
        projectId: savedProject._id.toString(),
        projectRole: ProjectRole.CREATOR, // Se asigna como creador al que lo crea
        organizationId, // Para check
      });
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


  // GET ONE
  async findOne(id: string): Promise<Project> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Project not found')
    const project = await this.projectModel.findById(id).lean()
    if (!project) throw new NotFoundException('Project not found')
    return project
  }

  // UPDATE
  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Project not found')
    const updated = await this.projectModel.findByIdAndUpdate(
      id,
      dto,
      { new: true, runValidators: true }
    ).lean()
    if (!updated) throw new NotFoundException('Project not found')
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
  async getAllProjectsByOrganizationId(organizationId: string): Promise<ProjectDocument[]> {
    return this.projectModel
      .find({
        organizationId: new Types.ObjectId(organizationId)
      })
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
}
