import { Injectable, NotFoundException } from "@nestjs/common";

// SERVICES
import { OrganizationService } from 'src/organization/organization.service';
import { ProjectService } from 'src/project/project.service';
import { BlueprintService } from 'src/blueprint/blueprint.service';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { ProjectMembershipService } from 'src/project_membership/project_membership.service';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { ActionType } from "src/activity-logs/common/types";

@Injectable()
export class DeleteOrganizationService {
    
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly projectService: ProjectService,
        private readonly blueprintService: BlueprintService,
        private readonly organizationMembershipService: OrganizationMembershipService,
        private readonly projectMembershipService: ProjectMembershipService,
        private readonly fileStorageService: FileStorageService,
        private readonly activityLogsService: ActivityLogsService,
    ) {}

    async deleteOrganization(
        organizationId: string,
        superadminId: string,
    ): Promise<string[]> {
        const errors: string[] = [];

        console.log("------ START DELETE ORG : ", organizationId, " ------");

        // 1. verify exists (CRITICAL)
        const organization = await this.organizationService.findOne(organizationId);
        if (!organization) {
            throw new NotFoundException("Organization with provided id doesn't exist");
        }
        console.log("1) Organization exists");

        // 2. projects
        const projects = await this.projectService.findByOrganizationId(organizationId);
        const projectIds = projects.map(p => p._id.toString());

        if (projectIds.length === 0) {
            console.log("2) No projects on this organization");
            console.log("3) Skipped storage IDs (no projects)");
            console.log("4) Skipped file deletion (no projects)");
            console.log("5) Skipped blueprint deletion (no projects)");
            console.log("6) Skipped project memberships deletion (no projects)");
        } else {
            console.log("2) Projects obtained");

            // 3. storage ids
            const storageIds = await this.blueprintService.getAllSotrageIdsByManyProjectIds(projectIds);
            console.log("3) Storage IDs obtained");

            // 4. delete files (NON-CRITICAL)
            const fileResults = await Promise.allSettled(
            storageIds.map(id => this.fileStorageService.deleteFile(id))
            );

            const failedFiles = fileResults.filter(r => r.status === 'rejected');
            if (failedFiles.length > 0) {
            errors.push(`Failed to delete ${failedFiles.length} files from storage`);
            } else {
            console.log("4) Files deleted");
            }

            // 5. blueprints
            try {
            await this.blueprintService.deleteBlueprintsByManyProjectIds(projectIds);
            console.log("5) Blueprints deleted");
            } catch {
            errors.push("Failed to delete blueprints");
            }

            // 6. project memberships
            try {
            await this.projectMembershipService.deleteAllMembershipsByManyProjectIds(projectIds);
            console.log("6) Project memberships deleted");
            } catch {
            errors.push("Failed to delete project memberships");
            }
        }

        // 7. projects (CRITICAL)
        await this.projectService.deleteAllProjectsByOrganizationId(organizationId);
        console.log("7) Projects deleted");

        // 8. org memberships (CRITICAL)
        await this.organizationMembershipService.deleteAllMembershipsByOrganizationId(organizationId);
        console.log("8) Org memberships deleted");

        // 9. organization (CRITICAL)
        await this.organizationService.remove(organizationId);
        console.log("9) Organization deleted");

        // 10. activity log
        this.activityLogsService.create(superadminId, {
            action: ActionType.DELETE_ORGANIZATION,
            description: `Delete organization "${organization.name}" including it's projects, blueprints, files and users memberships to it.`,
            targetName: `${organization.name}`,
            targetId: "deleted organization"
        })

        console.log("------------------------ DELETE COMPLETED ------------------------");

        return errors;
    }

}