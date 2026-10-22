import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListResponseDto } from './dto/user-list-response.dto';
import { UserEnvelopeDto } from './dto/user-envelope.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PermissionCatalogEnvelopeDto } from './dto/permission-catalog-response.dto';
import { RequirePermissions } from '../access-control/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../access-control/decorators/current-user.decorator';
import { PERMISSIONS } from '../access-control/permission-catalog';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List users', operationId: 'userListUsers' })
  @ApiOkResponse({ type: UserListResponseDto })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.service.findAll(query);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get permission catalog and role mappings', operationId: 'userGetPermissionCatalog' })
  @ApiOkResponse({ type: PermissionCatalogEnvelopeDto })
  getPermissionCatalog() {
    return this.service.getPermissionCatalog();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get user', operationId: 'userGetUser' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: 'Create user', operationId: 'userCreateUser' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: 'Update user', operationId: 'userUpdateUser' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Patch(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: 'Deactivate user', operationId: 'userDeactivateUser' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.service.deactivate(id, actor);
  }

  @Patch(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: 'Reactivate user', operationId: 'userReactivateUser' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  reactivate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.service.reactivate(id, actor);
  }
}
