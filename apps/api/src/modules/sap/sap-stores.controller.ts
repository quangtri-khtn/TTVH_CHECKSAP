import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../access-control/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';
import {
  BulkUpdateSapStoresByBrandDto,
  BulkUpdateSapStoresByBrandResponseDto,
} from './dto/bulk-update-sap-stores-by-brand.dto';
import { GetSapStoresQueryDto } from './dto/get-sap-stores-query.dto';
import { SapBrandListResponseDto } from './dto/sap-brand.dto';
import { SapStoreEnvelopeDto, SapStoreListResponseDto } from './dto/sap-store.dto';
import { SyncSapStoresResponseDto } from './dto/sync-sap-stores.dto';
import { UpdateSapStoreDto } from './dto/update-sap-store.dto';
import { SapBrandService } from './services/sap-brand.service';
import { SapStoreService } from './services/sap-store.service';

@ApiTags('SAP Stores')
@ApiBearerAuth()
@Controller('sap')
export class SapStoresController {
  constructor(
    private readonly brandService: SapBrandService,
    private readonly storeService: SapStoreService,
  ) {}

  @Get('brands')
  @RequireAnyPermissions(PERMISSIONS.SAP_MONITOR_READ, PERMISSIONS.SAP_STORE_MANAGE)
  @ApiOperation({
    summary: 'Lấy danh mục thương hiệu SAP',
    operationId: 'sapBrandsGet',
  })
  @ApiOkResponse({ type: SapBrandListResponseDto })
  async findAllBrands() {
    return this.brandService.findAll(true);
  }

  @Get('stores')
  @RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)
  @ApiOperation({
    summary: 'Lấy danh sách cửa hàng SAP kèm trạng thái kích hoạt',
    operationId: 'sapStoresGet',
  })
  @ApiOkResponse({ type: SapStoreListResponseDto })
  async findAllStores(@Query() query: GetSapStoresQueryDto) {
    return this.storeService.findAll(query);
  }

  @Patch('stores/bulk-brand')
  @RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)
  @ApiOperation({
    summary: 'Bật/tắt hàng loạt cửa hàng theo thương hiệu (mở theo trạng thái hoạt động trên SAP)',
    operationId: 'sapStoresBulkUpdateByBrand',
  })
  @ApiOkResponse({ type: BulkUpdateSapStoresByBrandResponseDto })
  async bulkUpdateStoresByBrand(@Body() dto: BulkUpdateSapStoresByBrandDto) {
    return this.storeService.bulkUpdateByBrand(dto);
  }

  @Patch('stores/:code')
  @RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)
  @ApiOperation({
    summary: 'Cập nhật trạng thái kích hoạt cửa hàng cho Monitor Bán / Trả',
    operationId: 'sapStoreUpdate',
  })
  @ApiOkResponse({ type: SapStoreEnvelopeDto })
  async updateStore(@Param('code') code: string, @Body() dto: UpdateSapStoreDto) {
    return this.storeService.update(code, dto);
  }

  @Post('stores/sync')
  @RequirePermissions(PERMISSIONS.SAP_STORE_MANAGE)
  @ApiOperation({
    summary: 'Đồng bộ danh sách cửa hàng từ bảng maycha_live.OWHS trên SAP HANA',
    operationId: 'sapStoresSync',
  })
  @ApiOkResponse({ type: SyncSapStoresResponseDto })
  async syncStoresFromSap() {
    return this.storeService.syncFromSap();
  }
}
