import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DailySheetsService } from './daily-sheets.service';
import {
  CreateDailySheetSchema,
  UpdateDailySheetSchema,
  ApproveDailySheetSchema,
  DailySheetQuerySchema,
} from './daily-sheets.dto';
import type { AuthRequest } from '../../middleware/auth';
import { Req } from '@nestjs/common';

@Controller('api/v1/daily-sheets')
export class DailySheetsController {
  constructor(private service: DailySheetsService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() body: any) {
    const dto = CreateDailySheetSchema.parse(body);
    return this.service.create(dto, req.organizationId, req.userId);
  }

  @Get()
  async list(@Req() req: AuthRequest, @Query() query: any) {
    const dto = DailySheetQuerySchema.parse(query);
    return this.service.list(req.organizationId, dto);
  }

  @Get(':id')
  async getById(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getById(id, req.organizationId);
  }

  @Put(':id')
  async update(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) {
    const dto = UpdateDailySheetSchema.parse(body);
    return this.service.update(id, dto, req.organizationId, req.userId);
  }

  @Post(':id/submit')
  async submit(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.submitForApproval(id, req.organizationId, req.userId);
  }

  @Post(':id/approve')
  async approve(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: any) {
    const dto = ApproveDailySheetSchema.parse(body);
    return this.service.approve(id, dto, req.organizationId, req.userId);
  }

  @Delete(':id')
  async delete(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.delete(id, req.organizationId);
  }
}
