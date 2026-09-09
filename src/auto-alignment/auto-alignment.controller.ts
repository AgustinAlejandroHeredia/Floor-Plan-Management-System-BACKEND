import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { AutoAlignmentService } from './auto-alignment.service';
import { SaveAlignmentDto } from './dto/save-alignment.dto';

@ApiTags('Blueprints')
@ApiBearerAuth('access-token')
@Controller('blueprints/:blueprintId')
export class AutoAlignmentController {
  constructor(private readonly autoAlignmentService: AutoAlignmentService) {}

  @Post('align')
  @UseGuards(JwtAuthGuard)
  @HttpCode(202)
  @ApiOperation({ summary: 'Re-run alignment for this blueprint against its counterpart' })
  @ApiParam({ name: 'blueprintId', type: String })
  async trigger(@Param('blueprintId') blueprintId: string, @Req() req) {
    // authorize before accepting; then run alignment off the request path
    await this.autoAlignmentService.assertBlueprintAccess(
      blueprintId,
      req.user.internalId,
      req.user.globalRole,
    );
    void this.autoAlignmentService.alignBlueprint(blueprintId, { cascade: true }).catch(() => undefined);
    return { accepted: true };
  }

  @Get('alignment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the stored alignment for this blueprint' })
  @ApiParam({ name: 'blueprintId', type: String })
  getAlignment(@Param('blueprintId') blueprintId: string, @Req() req) {
    return this.autoAlignmentService.getAlignment(
      blueprintId,
      req.user.internalId,
      req.user.globalRole,
    );
  }

  @Put('alignment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save an adjusted or manual alignment from the UI' })
  @ApiParam({ name: 'blueprintId', type: String })
  saveAlignment(
    @Param('blueprintId') blueprintId: string,
    @Body() dto: SaveAlignmentDto,
    @Req() req,
  ) {
    return this.autoAlignmentService.saveManualAlignment(
      blueprintId,
      dto,
      req.user.internalId,
      req.user.globalRole,
    );
  }
}
