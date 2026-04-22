import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// Schemas
import { 
    OrganizationMembership, 
    OrganizationMembershipDocument
} from 'src/organization_membership/schemas/organization_membership.schema';

import { 
    ProjectMembership, 
    ProjectMembershipDocument 
} from 'src/project_membership/schemas/project_membership.schema';

// Enums
import {
  OrganizationRole,
  ProjectRole,
  UserRole,
} from 'src/user/common/role.enum';

// Decorator keys
import {
  ORGANIZATION_ROLES_KEY,
} from '../decorators/organization-roles.decorator';

import {
  PROJECT_ROLES_KEY,
} from '../decorators/project-roles.decorator';

import {
  USER_ROLES_KEY,
} from '../decorators/user-roles.decorator';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,

    @InjectModel(OrganizationMembership.name)
    private orgMembershipModel: Model<OrganizationMembershipDocument>,

    @InjectModel(ProjectMembership.name)
    private projectMembershipModel: Model<ProjectMembershipDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const user = req.user;
    const userId = user?.internalId;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Leer metadata
    const orgRoles = this.reflector.get<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      context.getHandler(),
    );

    const projectRoles = this.reflector.get<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      context.getHandler(),
    );

    const userRoles = this.reflector.get<UserRole[]>(
      USER_ROLES_KEY,
      context.getHandler(),
    );

    // Si no hay restricciones → permitir
    if (!orgRoles && !projectRoles && !userRoles) {
      return true;
    }

    // SUPER ADMIN bypass
    if (user.globalRole === UserRole.SUPERADMIN) {
      return true;
    }

    const checks: boolean[] = [];

    // User roles (global)
    if (userRoles) {
      checks.push(userRoles.includes(user.globalRole));
    }

    // Organization roles
    if (orgRoles) {
      const organizationId = req.params.organizationId;

      if (!organizationId) {
        throw new ForbiddenException('Missing organizationId');
      }

      const membership = await this.orgMembershipModel.findOne({
        userId: new Types.ObjectId(userId),
        organizationId: new Types.ObjectId(organizationId),
      });

      if (membership) {
        checks.push(orgRoles.includes(membership.organizationRole as OrganizationRole));
      } else {
        checks.push(false);
      }
    }

    // Project roles
    if (projectRoles) {
      const projectId = req.params.projectId;

      if (!projectId) {
        throw new ForbiddenException('Missing projectId');
      }

      const membership = await this.projectMembershipModel.findOne({
        userId: new Types.ObjectId(userId),
        projectId: new Types.ObjectId(projectId),
      });

      if (membership) {
        checks.push(projectRoles.includes(membership.projectRole));
      } else {
        checks.push(false);
      }
    }

    // OR logic
    const hasAccess = checks.some(Boolean);

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}