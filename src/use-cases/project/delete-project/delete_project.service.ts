import { Injectable, NotFoundException } from "@nestjs/common";

// SERVICES
import { ProjectService } from "src/project/project.service";
import { BlueprintService } from "src/blueprint/blueprint.service";
import { FileStorageService } from "src/file-storage/file-storage.service";
import { ProjectMembershipService } from "src/project_membership/project_membership.service";

@Injectable()
export class DeleteProjectService {

    constructor(
        private readonly projectService: ProjectService,
        private readonly blueprintService: BlueprintService,
        private readonly fileStorageService: FileStorageService,
        private readonly projectMembershipService: ProjectMembershipService,
    ) {}

    async deleteProject(projectId: string): Promise<string[]> {

        const errors: string[] = [];

        console.log("------ START DELETE PROJECT : ", projectId, " ------");

        // 1. verify exists (CRITICAL)
        const project = await this.projectService.findOne(projectId);
        if (!project) {
            throw new NotFoundException("Project with provided id doesn't exist");
        }
        console.log("1) Project exists");

        // 2. storage ids
        const storageIds = await this.blueprintService.getAllStorageIdsByProjectId(projectId);

        if (!storageIds || storageIds.length === 0) {
            console.log("2) No storage IDs found (no blueprints)");
            console.log("3) Skipped file deletion (no storage IDs)");
        } else {
            console.log("2) Storage IDs obtained");

            // 3. delete files (NON-CRITICAL)
            const fileResults = await Promise.allSettled(
                storageIds.map(id => this.fileStorageService.deleteFile(id))
            );

            const failedFiles = fileResults.filter(r => r.status === 'rejected');
            if (failedFiles.length > 0) {
                errors.push(`Failed to delete ${failedFiles.length} files from storage`);
            } else {
                console.log("3) Files deleted");
            }
        }

        // 4. delete blueprints (SAFE)
        try {
            await this.blueprintService.deleteBlueprintsByProjectId(projectId);
            console.log("4) Blueprints deleted");
        } catch {
            console.log("4) Failed to delete blueprints");
            errors.push("Failed to delete blueprints");
        }

        // 5. project membership (SAFE)
        try {
            await this.projectMembershipService.deleteAllMembershipsByProjectId(projectId);
            console.log("5) Project memberships deleted");
        } catch {
            console.log("5) Failed to delete memberships");
            errors.push("Failed to delete memberships");
        }

        // 6. project (CRITICAL)
        await this.projectService.remove(projectId);
        console.log("6) Project deleted");

        console.log("------------------------ DELETE COMPLETED ------------------------");

        return errors;
    }

}