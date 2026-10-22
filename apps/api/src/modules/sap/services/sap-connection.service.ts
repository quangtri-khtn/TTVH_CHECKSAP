// Dịch vụ quản lý tài khoản kết nối SQL Server cho SAP:
// danh sách, thêm mới, cập nhật (an toàn khi sửa dòng đang dùng), Kiểm tra 3 bước và Kích hoạt.
// Chỉ truy cập bảng SapConnection của module sap và chỉ gọi checkCredentials / swapActivePool của gateway.
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma, SapConnection } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../access-control/decorators/current-user.decorator';
import type { CreateSapConnectionDto } from '../dto/create-sap-connection.dto';
import type { SapConnectionTestResultDto } from '../dto/sap-connection-test-result.dto';
import type { SapConnectionDto } from '../dto/sap-connection.dto';
import type { UpdateSapConnectionDto } from '../dto/update-sap-connection.dto';
import { loginFailedSteps } from '../lib/sap-check-steps';
import { toSapConnectionDto } from '../lib/sap-connection-mapper';
import { SapCredentialCipherService } from './sap-credential-cipher.service';
import { SapQueryGatewayService } from './sap-query-gateway.service';

export type SapConnectionActor = Pick<AuthUser, 'id' | 'name'>;

const DUPLICATE_USERNAME_MESSAGE = 'Tài khoản SQL này đã tồn tại';
const STALE_SNAPSHOT_MESSAGE = 'Thông tin kết nối vừa thay đổi, hãy tải lại và thử lại';
const NOT_FOUND_MESSAGE = 'Không tìm thấy kết nối SAP';

@Injectable()
export class SapConnectionService {
  private readonly logger = new Logger(SapConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SapCredentialCipherService,
    private readonly gateway: SapQueryGatewayService,
  ) {}

  /**
   * Lấy danh sách kết nối SAP, sắp xếp dòng đang dùng (`isActive = true`) lên đầu,
   * sau đó theo `username` tăng dần. Chạy được ngay cả khi máy chủ chưa cấu hình khóa mã hóa.
   */
  async list(): Promise<SapConnectionDto[]> {
    const rows = await this.prisma.sapConnection.findMany({
      orderBy: [{ isActive: 'desc' }, { username: 'asc' }],
    });
    return rows.map(toSapConnectionDto);
  }

  /**
   * Tạo mới tài khoản kết nối SAP ở trạng thái chưa kích hoạt (`isActive = false`).
   * Mã hóa mật khẩu bằng AES-256-GCM (ném 503 nếu thiếu khóa); trùng `username` trả 409.
   */
  async create(dto: CreateSapConnectionDto, actor: SapConnectionActor): Promise<SapConnectionDto> {
    const passwordEncrypted = this.cipher.encrypt(dto.password);

    try {
      const created = await this.prisma.sapConnection.create({
        data: {
          username: dto.username,
          passwordEncrypted,
          isActive: false,
          updatedById: actor.id,
          updatedByName: actor.name,
        },
      });
      this.logger.log(`sap connection created id=${created.id} by=${actor.id}`);
      return toSapConnectionDto(created);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictException(DUPLICATE_USERNAME_MESSAGE);
      }
      throw err;
    }
  }

  /**
   * Cập nhật tài khoản kết nối SAP an toàn và chống TOCTOU:
   * - Nếu sửa dòng đang dùng (`snap.isActive = true`) và có thay đổi `username` hoặc `password`:
   *   phải mở kết nối pool mới bằng thông tin đăng nhập mới ở NGOÀI khóa FIFO trước ->
   *   vào khóa -> chạy transaction `commit(tx)` ghi DB có điều kiện -> đổi tham chiếu `activePool` ->
   *   đóng pool cũ. Nhờ thứ tự này, nếu thông tin mới không đăng nhập được SQL Server thì
   *   nhận lỗi 502/503/504 đã map, DB không bị ghi đè và pool cũ vẫn phục vụ bình thường.
   * - Nếu sửa dòng thường hoặc không đổi thông tin đăng nhập: ghi có điều kiện bằng `updateMany`.
   */
  async update(
    id: string,
    dto: UpdateSapConnectionDto,
    actor: SapConnectionActor,
  ): Promise<SapConnectionDto> {
    const snap = await this.findRowOrThrow(id);

    const nextUsername = dto.username !== undefined ? dto.username : snap.username;
    const hasNewPassword = typeof dto.password === 'string' && dto.password.length > 0;
    const usernameChanged = nextUsername !== snap.username;
    const credentialsChanged = usernameChanged || hasNewPassword;

    const nextPasswordEncrypted = hasNewPassword ? this.cipher.encrypt(dto.password!) : undefined;

    const data: Prisma.SapConnectionUpdateManyMutationInput = {
      ...(dto.username !== undefined ? { username: dto.username } : {}),
      ...(nextPasswordEncrypted !== undefined ? { passwordEncrypted: nextPasswordEncrypted } : {}),
      ...(credentialsChanged ? { lastTestAt: null, lastTestOk: null } : {}),
      updatedById: actor.id,
      updatedByName: actor.name,
    };

    const where: Prisma.SapConnectionWhereInput = {
      id,
      username: snap.username,
      passwordEncrypted: snap.passwordEncrypted,
      isActive: snap.isActive,
    };

    const applyUpdate = async (db: Prisma.TransactionClient | PrismaService) => {
      const result = await db.sapConnection.updateMany({ where, data });
      if (result.count === 0) {
        throw new ConflictException(STALE_SNAPSHOT_MESSAGE);
      }
    };

    try {
      if (snap.isActive && credentialsChanged) {
        const plainPassword = hasNewPassword
          ? dto.password!
          : this.cipher.decrypt(snap.passwordEncrypted);

        // Thứ tự bắt buộc: mở pool mới bằng thông tin mới ở ngoài khóa -> vào khóa ->
        // chạy commit(tx) có điều kiện -> tráo tham chiếu activePool -> đóng pool cũ.
        // QUY TẮC CỨNG: callback commit(tx) chạy trong khóa FIFO không tái nhập (FifoLock),
        // chỉ được ghi DB qua tx, TUYỆT ĐỐI KHÔNG gọi bất kỳ hàm nào của gateway để tránh treo khóa.
        await this.gateway.swapActivePool(
          { username: nextUsername, password: plainPassword },
          applyUpdate,
          snap.id,
        );
      } else {
        await applyUpdate(this.prisma);
      }
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictException(DUPLICATE_USERNAME_MESSAGE);
      }
      throw err;
    }

    const updated = await this.findRowOrThrow(id);
    this.logger.log(`sap connection updated id=${id} by=${actor.id}`);
    return toSapConnectionDto(updated);
  }

  /**
   * Kiểm tra 3 bước kết nối SAP (đăng nhập SQL Server, OPENQUERY maycha_live, OPENQUERY kbmd_live):
   * - Thiếu khóa mã hóa (`SAP_CREDENTIAL_KEY`) hoặc thiếu/sai địa chỉ máy chủ (`SAP_SQL_HOST`) -> ném 503.
   * - Giải mã mật khẩu lỗi (ciphertext hỏng hoặc khóa đã đổi) -> trả HTTP 200 với bước 1 `failed`, không gọi gateway.
   * - Ghi `lastTestAt` và `lastTestOk` có điều kiện theo bản chụp đã đọc; nếu kết nối vừa bị đổi ở giữa thì bỏ qua.
   */
  async test(id: string, actor: SapConnectionActor): Promise<SapConnectionTestResultDto> {
    const snap = await this.findRowOrThrow(id);
    this.cipher.assertConfigured();

    const startedAt = Date.now();
    let plainPassword: string | undefined;

    try {
      plainPassword = this.cipher.decrypt(snap.passwordEncrypted);
    } catch {
      // Ciphertext hỏng hoặc khóa đã thay đổi -> trả bước 1 failed
    }

    const steps =
      plainPassword !== undefined
        ? await this.gateway.checkCredentials({
            username: snap.username,
            password: plainPassword,
          })
        : loginFailedSteps(
            'Không giải mã được mật khẩu đã lưu, hãy nhập lại mật khẩu cho kết nối này',
          );

    const ok = steps.every((step) => step.status === 'ok');
    const now = new Date();

    await this.prisma.sapConnection.updateMany({
      where: {
        id,
        username: snap.username,
        passwordEncrypted: snap.passwordEncrypted,
      },
      data: {
        lastTestAt: now,
        lastTestOk: ok,
      },
    });

    const durationMs = Date.now() - startedAt;
    this.logger.log(`sap connection test id=${id} by=${actor.id} ok=${ok} ms=${durationMs}`);

    return {
      ok,
      steps,
      durationMs,
    };
  }

  /**
   * Kích hoạt tài khoản kết nối SAP để làm pool đang dùng (`isActive = true`):
   * - Nếu dòng đã `isActive = true` thì trả ngay dòng hiện tại (no-op 200, không mở lại pool).
   * - Ngược lại: giải mã mật khẩu -> mở pool mới ngoài khóa -> trong khóa chạy transaction
   *   tắt các dòng khác trước rồi bật dòng đích có điều kiện -> đổi `activePool` -> đóng pool cũ.
   */
  async activate(id: string, actor: SapConnectionActor): Promise<SapConnectionDto> {
    const snap = await this.findRowOrThrow(id);
    if (snap.isActive) {
      return toSapConnectionDto(snap);
    }

    const plainPassword = this.cipher.decrypt(snap.passwordEncrypted);

    // Thứ tự bắt buộc: mở pool mới ở ngoài khóa -> vào khóa -> chạy transaction commit(tx)
    // (tắt các dòng khác trước vì partial unique index kiểm theo từng câu, sau đó bật dòng đích
    // có điều kiện chống TOCTOU) -> đổi tham chiếu activePool -> đóng pool cũ.
    // QUY TẮC CỨNG: callback commit(tx) chạy trong khóa FIFO không tái nhập (FifoLock),
    // chỉ được ghi DB qua tx, TUYỆT ĐỐI KHÔNG gọi bất kỳ hàm nào của gateway để tránh treo khóa.
    await this.gateway.swapActivePool(
      { username: snap.username, password: plainPassword },
      async (tx) => {
        await tx.sapConnection.updateMany({
          where: { id: { not: id } },
          data: { isActive: false },
        });
        const result = await tx.sapConnection.updateMany({
          where: {
            id,
            username: snap.username,
            passwordEncrypted: snap.passwordEncrypted,
          },
          data: {
            isActive: true,
            updatedById: actor.id,
            updatedByName: actor.name,
          },
        });
        if (result.count === 0) {
          throw new ConflictException(STALE_SNAPSHOT_MESSAGE);
        }
      },
      snap.id,
    );

    const updated = await this.findRowOrThrow(id);
    this.logger.log(`sap connection activated id=${id} by=${actor.id}`);
    return toSapConnectionDto(updated);
  }

  private async findRowOrThrow(id: string): Promise<SapConnection> {
    const row = await this.prisma.sapConnection.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }
    return row;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}
