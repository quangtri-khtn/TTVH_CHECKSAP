// Controller mỏng cho 5 endpoint quản lý kết nối SAP dưới /sap/connections.
// Cả 5 endpoint đều yêu cầu quyền sap-connection:manage; update, test và activate giới hạn 5 lần/phút.
import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../access-control/decorators/current-user.decorator';
import { RequirePermissions } from '../access-control/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';
import { CreateSapConnectionDto } from './dto/create-sap-connection.dto';
import {
  SapConnectionEnvelopeDto,
  SapConnectionListResponseDto,
  SapConnectionTestResponseDto,
} from './dto/sap-connection-response.dto';
import { UpdateSapConnectionDto } from './dto/update-sap-connection.dto';
import { SapConnectionService } from './services/sap-connection.service';

@ApiTags('SAP Connections')
@ApiBearerAuth()
@Controller('sap/connections')
export class SapConnectionsController {
  constructor(private readonly service: SapConnectionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SAP_CONNECTION_MANAGE)
  @ApiOperation({
    summary: 'List SAP connections',
    operationId: 'sapConnectionListConnections',
  })
  @ApiOkResponse({ type: SapConnectionListResponseDto })
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SAP_CONNECTION_MANAGE)
  @ApiOperation({
    summary: 'Create SAP connection',
    operationId: 'sapConnectionCreateConnection',
  })
  @ApiOkResponse({ type: SapConnectionEnvelopeDto })
  create(@Body() dto: CreateSapConnectionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SAP_CONNECTION_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update SAP connection',
    operationId: 'sapConnectionUpdateConnection',
  })
  @ApiOkResponse({ type: SapConnectionEnvelopeDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSapConnectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/test')
  @RequirePermissions(PERMISSIONS.SAP_CONNECTION_MANAGE)
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Test SAP connection (3 steps)',
    operationId: 'sapConnectionTestConnection',
  })
  @ApiOkResponse({ type: SapConnectionTestResponseDto })
  test(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.test(id, user);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.SAP_CONNECTION_MANAGE)
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Activate SAP connection',
    operationId: 'sapConnectionActivateConnection',
  })
  @ApiOkResponse({ type: SapConnectionEnvelopeDto })
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.activate(id, user);
  }
}
