// Mapper chuyển đổi bản ghi SapConnection từ DB sang SapConnectionDto theo cơ chế whitelist.
// Tuyệt đối không dùng toán tử spread (...) trên dòng DB để ngăn rò rỉ passwordEncrypted.
import type { SapConnection } from '../../../generated/prisma/client';
import type { SapConnectionDto } from '../dto/sap-connection.dto';

export function toSapConnectionDto(row: SapConnection): SapConnectionDto {
  return {
    id: row.id,
    username: row.username,
    hasPassword: row.passwordEncrypted.length > 0,
    isActive: row.isActive,
    lastTestAt: row.lastTestAt,
    lastTestOk: row.lastTestOk,
    updatedById: row.updatedById,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
