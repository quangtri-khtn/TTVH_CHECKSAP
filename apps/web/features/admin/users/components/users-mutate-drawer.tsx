'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { userSchema, type UserFormValues } from '@/lib/admin/user-schemas';
import {
  buildPermissionMatrix,
  togglePermission,
  toCustomPayload,
} from '@/lib/admin/user-permission-matrix';
import { CreateUserDtoRole, type UserResponseDto } from '@/lib/api/generated/model';
import { useUserGetPermissionCatalog } from '@/lib/api/generated/users/users';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePermissions } from '@/lib/auth/use-permissions';
import { UserPermissionMatrix } from './user-permission-matrix';
const ROLE_OPTIONS = [
  {
    value: CreateUserDtoRole.ADMIN,
    label: 'Quản trị viên',
    hint: 'Toàn quyền quản lý danh mục, hệ thống, người dùng và yêu cầu hỗ trợ.',
  },
  {
    value: CreateUserDtoRole.EMPLOYEE,
    label: 'Nhân viên',
    hint: 'Xem cổng thông tin và gửi yêu cầu hỗ trợ.',
  },
] as const;

const FORM_ID = 'users-mutate-form';

export type UserMutateFormValues = Omit<UserFormValues, 'role' | 'customPermissions'> & {
  role?: CreateUserDtoRole;
  customPermissions?: string[];
};

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có giá trị nghĩa là đang sửa; bỏ trống là thêm mới. */
  currentRow?: UserResponseDto;
  onSubmit: (values: UserMutateFormValues) => void;
  isPending: boolean;
}) {
  const isUpdate = Boolean(currentRow);
  const { user: currentUser } = useCurrentUser();
  const { isSuperAdmin, permissions: actorPermissions } = usePermissions();
  const isSelf = Boolean(currentRow && currentUser?.id === currentRow.id);
  const { data: catalogResponse, isLoading: isLoadingCatalog } = useUserGetPermissionCatalog();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      role: CreateUserDtoRole.EMPLOYEE,
      customPermissions: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      currentRow
        ? {
            email: currentRow.email,
            password: '',
            name: currentRow.name,
            role: currentRow.role,
            customPermissions: currentRow.customPermissions ?? [],
          }
        : {
            email: '',
            password: '',
            name: '',
            role: CreateUserDtoRole.EMPLOYEE,
            customPermissions: [],
          },
    );
  }, [open, currentRow, form]);

  const selectedRole = form.watch('role');
  const selectedCustom = form.watch('customPermissions') ?? [];

  const matrixGroups = useMemo(() => {
    const catalog = catalogResponse?.data?.data?.permissions ?? [];
    const rolePermissions = catalogResponse?.data?.data?.roles ?? {
      ADMIN: ['*'],
      EMPLOYEE: [],
    };
    return buildPermissionMatrix({
      catalog,
      rolePermissions,
      selectedRole,
      selectedCustomPermissions: selectedCustom,
      actorPermissions,
      readOnly: isSelf,
    });
  }, [catalogResponse, selectedRole, selectedCustom, actorPermissions, isSelf]);

  const handleTogglePermission = useCallback(
    (key: string) => {
      const current = form.getValues('customPermissions') ?? [];
      const next = togglePermission(current, key);
      form.setValue('customPermissions', next, { shouldValidate: true, shouldDirty: true });
    },
    [form],
  );
  const handleSubmit = form.handleSubmit((values) => {
    // Chặn submit khi catalog quyền chưa tải xong hoặc không có dữ liệu (chống Enter key bypass)
    if (isLoadingCatalog || !catalogResponse) {
      return;
    }

    // Khi thêm mới, mật khẩu là bắt buộc — schema để optional vì lúc sửa bỏ
    // trống nghĩa là giữ nguyên mật khẩu cũ.
    if (!isUpdate && values.password.length < 8) {
      form.setError('password', { message: 'Mật khẩu tối thiểu 8 ký tự' });
      return;
    }
    // Khi sửa tài khoản, nếu có nhập mật khẩu mới thì phải đạt tối thiểu 8 ký tự
    if (isUpdate && values.password.length > 0 && values.password.length < 8) {
      form.setError('password', { message: 'Mật khẩu tối thiểu 8 ký tự' });
      return;
    }

    // Khi tự sửa tài khoản chính mình (isSelf), bỏ qua role và customPermissions
    // để không bị backend assertNotSelfLockout từ chối với lỗi 400.
    if (isSelf) {
      onSubmit({
        ...values,
        role: undefined,
        customPermissions: undefined,
      });
      return;
    }

    const cleanCustom = toCustomPayload(matrixGroups);
    onSubmit({
      ...values,
      customPermissions: cleanCustom,
    });
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader className="text-start">
          <SheetTitle>{isUpdate ? 'Sửa người dùng' : 'Thêm người dùng'}</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Cập nhật thông tin tài khoản. Bấm Lưu khi hoàn tất.'
              : 'Điền thông tin để tạo tài khoản mới. Bấm Lưu khi hoàn tất.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form id={FORM_ID} onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ tên</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nguyễn Văn A" autoComplete="name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="ten@congty.com" autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mật khẩu</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder={isUpdate ? 'Để trống nếu không đổi' : 'Tối thiểu 8 ký tự'}
                      autoComplete="new-password"
                    />
                  </FormControl>
                  {isUpdate && <FormDescription>Bỏ trống để giữ nguyên mật khẩu hiện tại.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vai trò</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSelf}
                      className="flex flex-col gap-3"
                    >
                      {ROLE_OPTIONS.map((option) => {
                        const isOptionDisabled =
                          isSelf || (option.value === CreateUserDtoRole.ADMIN && !isSuperAdmin);
                        return (
                          <FormItem key={option.value} className="flex items-start gap-3">
                            <FormControl>
                              <RadioGroupItem
                                value={option.value}
                                disabled={isOptionDisabled}
                                className="mt-1"
                              />
                            </FormControl>
                            <div className="grid gap-0.5">
                              <FormLabel className="font-normal">{option.label}</FormLabel>
                              <p className="text-xs text-muted-foreground">{option.hint}</p>
                              {option.value === CreateUserDtoRole.ADMIN && !isSuperAdmin && (
                                <p className="text-[11px] text-destructive">
                                  Chỉ Quản trị viên cấp cao mới có quyền gán vai trò này.
                                </p>
                              )}
                            </div>
                          </FormItem>
                        );
                      })}
                    </RadioGroup>
                  </FormControl>
                  {isSelf && (
                    <FormDescription className="text-xs">
                      Không thể tự thay đổi vai trò của chính mình.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium">Quyền bổ sung</FormLabel>
                <FormDescription className="text-xs">
                  {isSelf
                    ? 'Không thể tự điều chỉnh quyền hạn của chính mình.'
                    : 'Cấp thêm quyền cụ thể ngoài các quyền mặc định của vai trò.'}
                </FormDescription>
              </div>
              <UserPermissionMatrix
                groups={matrixGroups}
                selectedRole={selectedRole}
                onToggle={handleTogglePermission}
                isLoading={isLoadingCatalog}
                disabled={isSelf || isPending}
              />
            </div>
          </form>
        </Form>

        <SheetFooter className="gap-2">
          <SheetClose render={<Button variant="outline" />}>Đóng</SheetClose>
          <Button form={FORM_ID} type="submit" disabled={isPending || isLoadingCatalog || !catalogResponse}>
            {isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
