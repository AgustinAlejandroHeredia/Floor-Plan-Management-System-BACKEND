import { Module } from '@nestjs/common';

import { DeleteOrganizationController } from './delete_organization.controller';
import { DeleteOrganizationService } from './delete_organization.service';

// RELATIONSHIP
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';
import { ProjectMembershipModule } from 'src/project_membership/project_membership.module';

// ORGANIZATION
import { OrganizationModule } from 'src/organization/organization.module';

// PROJECT
import { ProjectModule } from 'src/project/project.module';

// BLUEPRINT
import { BlueprintModule } from 'src/blueprint/blueprint.module';

// FILE-STORAGE
import { FileStorageModule } from 'src/file-storage/file-storage.module';

// AUTHMODULE
import { AuthModule } from 'src/auth/auth.module';

// ACTIVITIES LOGS
import { ActivityLogsModule } from 'src/activity-logs/activity-logs.module';

@Module({
    imports: [
        AuthModule,
        OrganizationMembershipModule,
        ProjectMembershipModule,
        OrganizationModule,
        ProjectModule,
        BlueprintModule,
        FileStorageModule,
        ActivityLogsModule,
    ],
    providers: [
        DeleteOrganizationService,
    ],
    exports: [
        DeleteOrganizationService,
    ],
    controllers: [
        DeleteOrganizationController,
    ],
})
export class DeleteOrganizationModule {}