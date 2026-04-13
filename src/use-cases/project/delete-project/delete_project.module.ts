import { Module } from '@nestjs/common';

import { DeleteProjectController } from './delete_project.controller';
import { DeleteProjectService } from './delete_project.service';

// RELATIONSHIP
import { ProjectMembershipModule } from 'src/project_membership/project_membership.module';
import { OrganizationMembershipModule } from 'src/organization_membership/organization_membership.module';

// PROJECT
import { ProjectModule } from 'src/project/project.module';

// BLUEPRINT
import { BlueprintModule } from 'src/blueprint/blueprint.module';

// FILE-STORAGE
import { FileStorageModule } from 'src/file-storage/file-storage.module';

// AUTHMODULE
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [
        AuthModule,
        OrganizationMembershipModule,
        ProjectMembershipModule,
        ProjectModule,
        BlueprintModule,
        FileStorageModule,
    ],
    providers: [
        DeleteProjectService,
    ],
    exports: [
        DeleteProjectService,
    ],
    controllers: [
        DeleteProjectController,
    ],
})
export class DeleteProjectModule {}