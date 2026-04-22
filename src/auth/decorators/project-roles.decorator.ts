import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from 'src/user/common/role.enum';

export const PROJECT_ROLES_KEY = 'project_roles';

export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);