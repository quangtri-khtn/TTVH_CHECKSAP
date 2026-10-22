// Controller mỏng cho các endpoint dưới /sap/sales-monitor: lấy dữ liệu JSON, xuất Excel chi tiết 11 sheets và xuất Excel lưới đang xem.
import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RequirePermissions } from '../access-control/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';
import { ExportSalesMonitorGridQueryDto } from './dto/sales-monitor-export-grid.dto';
import { GetSalesMonitorQueryDto } from './dto/sales-monitor-query.dto';
import {
  SalesMonitorDataDto,
  SalesMonitorResponseDto,
} from './dto/sales-monitor-response.dto';
import { SapSalesMonitorExcelService } from './services/sap-sales-monitor-excel.service';
import { SapSalesMonitorService } from './services/sap-sales-monitor.service';

@ApiTags('SAP Monitor')
@ApiBearerAuth()
@Controller('sap/sales-monitor')
export class SapSalesMonitorController {
  constructor(
    private readonly service: SapSalesMonitorService,
    private readonly excelService: SapSalesMonitorExcelService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @ApiOperation({
    summary: 'Lấy dữ liệu Monitor Bán hàng (Go-live)',
    operationId: 'sapSalesMonitorGetData',
  })
  @ApiOkResponse({
    description:
      'Dữ liệu Monitor Bán hàng hoàn chỉnh gồm 5 phần: meta, summary, cohorts, docStatus, lists',
    type: SalesMonitorResponseDto,
  })
  getData(@Query() query: GetSalesMonitorQueryDto): Promise<SalesMonitorDataDto> {
    return this.service.getSalesMonitor(query);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async exportDetail(
    @Query() query: GetSalesMonitorQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.excelService.exportDetailWorkbook(query);
    this.sendExcelBuffer(res, filename, buffer);
  }

  @Get('export-grid')
  @RequirePermissions(PERMISSIONS.SAP_MONITOR_READ)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async exportGrid(
    @Query() query: ExportSalesMonitorGridQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.excelService.exportGridWorkbook(query);
    this.sendExcelBuffer(res, filename, buffer);
  }

  private sendExcelBuffer(res: Response, filename: string, buffer: Buffer): void {
    const asciiFallback = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.end(buffer);
  }
}
