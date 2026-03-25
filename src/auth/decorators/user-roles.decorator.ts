import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/common/role.enum';

export const USER_ROLES_KEY = 'user_roles';

export const UserRoles = (...roles: UserRole[]) =>
  SetMetadata(USER_ROLES_KEY, roles);