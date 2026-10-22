'use client';

import { useEffect, useMemo } from 'react';
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  createSapConnectionFormSchema,
  type SapConnectionFormValues,
} from '@/lib/admin/sap-connection-schemas';
import type { SapConnectionDto } from '@/lib/api/generated/model';

const FORM_ID = 'sap-connections-mutate-form';

export function SapConnectionsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRow?: SapConnectionDto;
  onSubmit: (values: SapConnectionFormValues) => void | Promise<void>;
  isPending: boolean;
}) {
  const isUpdate = Boolean(currentRow);
  const currentRowId = currentRow?.id;
  const currentRowUsername = currentRow?.username;
  const schema = useMemo(
    () => createSapConnectionFormSchema(currentRowUsername),
    [currentRowUsername],
  );

  const form = useForm<SapConnectionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        username: currentRowUsername ?? '',
        password: '',
      });
    } else {
      form.reset({
        username: '',
        password: '',
      });
    }
  }, [open, currentRowId, currentRowUsername, form]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <SheetContent className="flex flex-col" showCloseButton={!isPending}>
        <SheetHeader className="text-start">
          <SheetTitle>
            {isUpdate ? 'Sửa tài khoản kết nối SAP' : 'Thêm tài khoản kết nối SAP'}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? 'Cập nhật thông tin tài khoản SQL Server trung gian. Bấm Lưu khi hoàn tất.'
              : 'Điền thông tin tài khoản SQL Server trung gian mới. Bấm Lưu khi hoàn tất.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id={FORM_ID}
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-6 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tài khoản SQL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="vd: sap_readonly"
                      autoComplete="off"
                      disabled={isPending}
                    />
                  </FormControl>
                  {currentRow?.isActive && (
                    <FormDescription>
                      Tài khoản này đang được sử dụng. Khi lưu thay đổi, hệ thống sẽ thử kết nối mới
                      trước khi áp dụng.
                    </FormDescription>
                  )}
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
                      autoComplete="new-password"
                      disabled={isPending}
                      placeholder={
                        isUpdate ? 'Để trống nếu giữ mật khẩu cũ' : 'Nhập mật khẩu SQL Server'
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Để trống = giữ nguyên mật khẩu cũ (khi sửa). Mật khẩu được mã hóa AES-256-GCM và
                    không bao giờ hiển thị lại.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <SheetFooter className="gap-2">
          <SheetClose render={<Button variant="outline" disabled={isPending} />}>Hủy</SheetClose>
          <Button form={FORM_ID} type="submit" disabled={isPending}>
            {isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
