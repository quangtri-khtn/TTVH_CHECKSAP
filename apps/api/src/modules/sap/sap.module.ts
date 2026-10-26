// Module SAP cung cấp API quản lý kết nối SQL Server và export các service cho module Monitor.
import { Module } from '@nestjs/common';
import { SapConnectionsController } from './sap-connections.controller';
import { SapSalesMonitorController } from './sap-sales-monitor.controller';
import { SapReturnMonitorController } from './sap-return-monitor.controller';
import { SapStoresController } from './sap-stores.controller';
import { SapConnectionService } from './services/sap-connection.service';
import { SapCredentialCipherService } from './services/sap-credential-cipher.service';
import { SapQueryGatewayService } from './services/sap-query-gateway.service';
import { SapSalesMonitorExcelService } from './services/sap-sales-monitor-excel.service';
import { SapSalesMonitorService } from './services/sap-sales-monitor.service';
import { SapReturnMonitorExcelService } from './services/sap-return-monitor-excel.service';
import { SapReturnMonitorService } from './services/sap-return-monitor.service';
import { SapBrandService } from './services/sap-brand.service';
import { SapStoreService } from './services/sap-store.service';

@Module({
  controllers: [
    SapConnectionsController,
    SapSalesMonitorController,
    SapReturnMonitorController,
    SapStoresController,
  ],
  providers: [
    SapConnectionService,
    SapQueryGatewayService,
    SapCredentialCipherService,
    SapSalesMonitorService,
    SapSalesMonitorExcelService,
    SapReturnMonitorService,
    SapReturnMonitorExcelService,
    SapBrandService,
    SapStoreService,
  ],
  exports: [
    SapQueryGatewayService,
    SapSalesMonitorService,
    SapSalesMonitorExcelService,
    SapReturnMonitorService,
    SapReturnMonitorExcelService,
    SapBrandService,
    SapStoreService,
  ],
})
export class SapModule {}
