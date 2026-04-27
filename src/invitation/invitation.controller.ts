import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

// AUTHENTICATION
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { AccessGuard } from 'src/auth/guards/access.guard';

// SWAGGER
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@Controller('invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req,
    @Body() createInvitationDto: CreateInvitationDto,
  ) {
    return this.invitationService.create(req.user.internalId, createInvitationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/validateInvitation/:code')
  validateInvitation(
    @Req() req,
    @Param('code') code: string, 
  ) {
    return this.invitationService.validateInvitation(req.user.internalId, code)
  }

  @Get()
  findAll() {
    return this.invitationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invitationService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invitationService.remove(+id);
  }
}
