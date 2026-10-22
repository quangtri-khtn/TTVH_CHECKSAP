import { z } from 'zod';
import { ApiError } from '@/lib/api/http-client';
import type {
  CreateSapConnectionDto,
  SapConnectionDto,
  UpdateSapConnectionDto,
} from '@/lib/api/generated/model';

export const sapConnectionBaseSchema = z.object({
  username: z.string().trim().min(1, 'Tài khoản SQL là bắt buộc').max(128, 'Tối đa 128 ký tự'),
  password: z.string().max(128, 'Tối đa 128 ký tự'),
});

export type SapConnectionFormValues = z.infer<typeof sapConnectionBaseSchema>;

export function createSapConnectionFormSchema(currentRowUsername?: string) {
  return sapConnectionBaseSchema.superRefine((values, ctx) => {
    if (currentRowUsername === undefined && values.password.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Mật khẩu là bắt buộc khi thêm tài khoản mới',
      });
    }

    if (
      currentRowUsername !== undefined &&
      values.username !== currentRowUsername &&
      values.password.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Khi đổi tên tài khoản SQL, vui lòng nhập lại mật khẩu cho tài khoản mới',
      });
    }
  });
}

export function buildCreateSapConnectionPayload(
  values: SapConnectionFormValues,
): CreateSapConnectionDto {
  return {
    username: values.username.trim(),
    password: values.password,
  };
}

export function buildUpdateSapConnectionPayload(
  values: SapConnectionFormValues,
  currentRow: Pick<SapConnectionDto, 'username'>,
): UpdateSapConnectionDto | null {
  const trimmedUsername = values.username.trim();
  const usernameChanged = trimmedUsername !== currentRow.username;
  const hasNewPassword = values.password.length > 0;

  if (!usernameChanged && !hasNewPassword) {
    return null;
  }

  return {
    ...(usernameChanged ? { username: trimmedUsername } : {}),
    ...(hasNewPassword ? { password: values.password } : {}),
  };
}

export function getSapConnectionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return 'Thao tác quá nhanh (tối đa 5 lần/phút), vui lòng đợi một lát rồi thử lại.';
    }
    if (/^HTTP \d+$/.test(err.message)) {
      return 'Máy chủ không phản hồi kịp, vui lòng thử lại.';
    }
    if (err.message) {
      return err.message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}
