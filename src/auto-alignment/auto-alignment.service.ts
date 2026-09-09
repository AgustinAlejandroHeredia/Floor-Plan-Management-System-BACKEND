import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

import {
  Blueprint,
  BlueprintDocument,
  LevelsRange,
  SectionView,
} from 'src/blueprint/schemas/blueprint.schema';
import { SpecialtyTag } from 'src/blueprint/common/blueprintLabel';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { OrganizationMembershipService } from 'src/organization_membership/organization_membership.service';
import { AlignRunnerService, AlignmentResult } from './align-runner.service';
import { AutoAlignmentGateway } from './auto-alignment.gateway';
import { SaveAlignmentDto } from './dto/save-alignment.dto';

const COMPLEMENT: Partial<Record<SpecialtyTag, SpecialtyTag>> = {
  [SpecialtyTag.ARCHITECTURE]: SpecialtyTag.STRUCTURE,
  [SpecialtyTag.STRUCTURE]: SpecialtyTag.ARCHITECTURE,
};

interface AlignOptions {
  userId?: string;        // when set, authorize the caller
  userGlobalRole?: string;
  cascade?: boolean;      // re-align the counterpart afterwards (default true)
}

/**
 * Aligns a blueprint onto its architectural/structural counterpart with the
 * `floorplan_align` library. The FPMS detectors emit no columns, so the automatic
 * path is georeference (detected scale + orientation pin scale/rotation, MI solves
 * translation) and is always coarse -> flagged `needs_review` for the manual UI.
 * Column landmarks are still passed when present, so a future structural/column
 * detector upgrades this to a precise fit with no further changes.
 */
@Injectable()
export class AutoAlignmentService {
  private readonly logger = new Logger(AutoAlignmentService.name);
  private readonly columnTypes: string[];

  constructor(
    @InjectModel(Blueprint.name)
    private readonly blueprintModel: Model<BlueprintDocument>,
    private readonly storageService: FileStorageService,
    private readonly runner: AlignRunnerService,
    private readonly gateway: AutoAlignmentGateway,
    private readonly configService: ConfigService,
    private readonly organizationMembershipService: OrganizationMembershipService,
  ) {
    this.columnTypes = (this.configService.get<string>('ALIGN_COLUMN_TYPES') ?? 'column')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  /** Fire-and-forget hook used right after a blueprint is created (system-trusted). */
  alignOnCreate(blueprint: BlueprintDocument): void {
    void this.alignBlueprint(String(blueprint._id), { cascade: true }).catch((err) =>
      this.logger.error(
        `auto-alignment failed for blueprint ${String(blueprint._id)}: ${err?.message ?? err}`,
      ),
    );
  }

  /** Throw unless the caller may access this blueprint (used before async triggers). */
  async assertBlueprintAccess(blueprintId: string, userId: string, userGlobalRole: string): Promise<void> {
    const bp = await this.blueprintModel.findById(blueprintId).select('organizationId');
    if (!bp) throw new NotFoundException('Blueprint not found');
    await this.authorize(bp.organizationId.toString(), userId, userGlobalRole);
  }

  async getAlignment(blueprintId: string, userId?: string, userGlobalRole?: string) {
    const bp = await this.blueprintModel
      .findById(blueprintId)
      .select('alignment organizationId')
      .lean();
    if (!bp) throw new NotFoundException('Blueprint not found');
    await this.authorize(bp.organizationId.toString(), userId, userGlobalRole);
    return bp.alignment ?? null;
  }

  /** Persist a user-adjusted or fully-manual transform coming from the UI. */
  async saveManualAlignment(
    blueprintId: string,
    dto: SaveAlignmentDto,
    userId?: string,
    userGlobalRole?: string,
  ) {
    const bp = await this.blueprintModel.findById(blueprintId).select('organizationId');
    if (!bp) throw new NotFoundException('Blueprint not found');
    await this.authorize(bp.organizationId.toString(), userId, userGlobalRole);

    const alignment = {
      alignedWith: new Types.ObjectId(dto.alignedWith),
      matrix: dto.matrix,
      scale: dto.scale,
      rotationDeg: dto.rotationDeg,
      translation: dto.translation ?? [],
      confidence: dto.confidence,
      model: 'manual',
      method: 'manual',
      status: dto.status ?? 'manual',
      source: 'manual',
      updatedAt: new Date(),
    };
    await this.blueprintModel.findByIdAndUpdate(blueprintId, { $set: { alignment } });
    this.gateway.emitAlignmentUpdate(blueprintId, alignment.status, alignment);
    return alignment;
  }

  /** Compute and store the alignment of `blueprintId` onto its counterpart. */
  async alignBlueprint(blueprintId: string, opts: AlignOptions = {}): Promise<AlignmentResult | null> {
    const blueprint = await this.blueprintModel.findById(blueprintId);
    if (!blueprint) throw new NotFoundException('Blueprint not found');
    await this.authorize(blueprint.organizationId.toString(), opts.userId, opts.userGlobalRole);

    const counterpart = await this.findCounterpart(blueprint);
    if (!counterpart) {
      await this.persist(blueprintId, { status: 'needs_review', method: 'none' } as AlignmentResult, null);
      this.gateway.emitAlignmentUpdate(blueprintId, 'needs_review', null);
      return null;
    }

    // georeference priors from detected drawing scale + north orientation
    const scaleRatio =
      blueprint.scale && counterpart.scale ? counterpart.scale / blueprint.scale : undefined;
    const rotationPrior =
      blueprint.orientation != null && counterpart.orientation != null
        ? counterpart.orientation - blueprint.orientation
        : undefined;

    const temps: string[] = [];
    try {
      const [srcImg, dstImg] = await Promise.all([
        this.downloadToTemp(blueprint, temps),
        this.downloadToTemp(counterpart, temps),
      ]);

      const result = await this.runner.align(
        srcImg,
        dstImg,
        this.columnCentroids(blueprint.sectionViews),
        this.columnCentroids(counterpart.sectionViews),
        scaleRatio,
        rotationPrior,
      );

      await this.persist(blueprintId, result, counterpart._id);
      this.gateway.emitAlignmentUpdate(blueprintId, this.resolveStatus(result), {
        ...result,
        alignedWith: String(counterpart._id),
      });

      // If the counterpart was uploaded first and is still unaligned, align it now too.
      if (opts.cascade !== false) this.maybeRealignCounterpart(counterpart);
      return result;
    } catch (err) {
      this.logger.error(`alignBlueprint(${blueprintId}) error: ${err?.message ?? err}`);
      await this.persist(
        blueprintId,
        { status: 'failed', error: String(err?.message ?? err) } as AlignmentResult,
        counterpart._id,
      );
      this.gateway.emitAlignmentUpdate(blueprintId, 'failed', null);
      return null;
    } finally {
      await Promise.all(temps.map((f) => fs.unlink(f).catch(() => undefined)));
    }
  }

  // ---------------------------------------------------------------- helpers

  private async authorize(organizationId: string, userId?: string, userGlobalRole?: string): Promise<void> {
    if (!userId) return; // system-triggered (create/inference hook) is trusted
    await this.organizationMembershipService.validateOrganizationAccess(
      userId,
      organizationId,
      userGlobalRole ?? '',
    );
  }

  private maybeRealignCounterpart(counterpart: BlueprintDocument): void {
    const status = counterpart.alignment?.status;
    if (!counterpart.alignment || status === 'needs_review' || status === 'failed') {
      void this.alignBlueprint(String(counterpart._id), { cascade: false }).catch(() => undefined);
    }
  }

  private async findCounterpart(blueprint: BlueprintDocument): Promise<BlueprintDocument | null> {
    const discipline = (blueprint.specialties ?? []).find((s) => s in COMPLEMENT);
    if (!discipline) return null;
    const candidates = await this.blueprintModel
      .find({
        projectId: blueprint.projectId,
        _id: { $ne: blueprint._id },
        specialties: COMPLEMENT[discipline],
      })
      .sort({ creationDate: -1 })
      .exec();
    if (!candidates.length) return null;
    // prefer a counterpart on the same floor/level; else the most recent
    const sameLevel = candidates.filter((c) => this.levelsOverlap(blueprint.levels, c.levels));
    return sameLevel[0] ?? candidates[0];
  }

  private levelsOverlap(a?: LevelsRange[], b?: LevelsRange[]): boolean {
    if (!a?.length || !b?.length) return false; // unknown levels -> not a match signal
    for (const x of a) {
      for (const y of b) {
        if (x.basement && y.basement) return true;
        if (x.roof && y.roof) return true;
        if (x.bottom != null && x.top != null && y.bottom != null && y.top != null &&
            x.bottom <= y.top && y.bottom <= x.top) {
          return true;
        }
      }
    }
    return false;
  }

  private columnCentroids(sectionViews?: SectionView[]): number[][] {
    if (!sectionViews?.length) return [];
    const isColumn = (sv: SectionView) => {
      const tag = `${sv.type ?? ''} ${sv.label ?? ''}`.toLowerCase();
      return this.columnTypes.some((t) => tag.includes(t));
    };
    const out: number[][] = [];
    for (const sv of sectionViews) {
      if (!isColumn(sv) || !sv.coordsList?.length) continue;
      const n = sv.coordsList.length;
      const cx = sv.coordsList.reduce((s, c) => s + c.x, 0) / n;
      const cy = sv.coordsList.reduce((s, c) => s + c.y, 0) / n;
      out.push([cx, cy]);
    }
    return out;
  }

  private async downloadToTemp(blueprint: BlueprintDocument, temps: string[]): Promise<string> {
    const url = await this.storageService.getSignedDownloadUrl(blueprint.filename);
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
    const buf = Buffer.from(res.data);
    const isWebP =
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP';
    const ext = isWebP ? '.webp' : path.extname(blueprint.filename) || '.jpg';
    const p = path.join(os.tmpdir(), `align_${randomUUID()}${ext}`);
    await fs.writeFile(p, buf);
    temps.push(p);
    return p;
  }

  private resolveStatus(result: AlignmentResult): string {
    if (result.status === 'failed') return 'failed';
    if (result.needs_review) return 'needs_review';
    return result.status ?? 'needs_review';
  }

  private async persist(
    blueprintId: string,
    result: AlignmentResult,
    alignedWith: Types.ObjectId | null,
  ): Promise<void> {
    const alignment: Record<string, unknown> = {
      status: this.resolveStatus(result),
      matrix: result.matrix_2x3 ?? [],
      scale: result.scale,
      rotationDeg: result.rotation_deg,
      translation: result.translation ?? [],
      confidence: result.confidence ?? undefined,
      rmse: result.rmse ?? undefined,
      model: result.model,
      method: result.method,
      source: 'ai',
      updatedAt: new Date(),
    };
    if (alignedWith) alignment.alignedWith = alignedWith;
    await this.blueprintModel.findByIdAndUpdate(blueprintId, { $set: { alignment } });
  }
}
