import { OrganizationRole } from "src/user/common/role.enum"
import { Organization } from "../schemas/organization.schema"

export type OrganizationWithRoles = {
    organization: Organization,
    role: OrganizationRole,
}