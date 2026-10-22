import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const COPY: Record<'deactivate' | 'reactivate', { title: (label: string) => string; description: string }> = {
  deactivate: {
    title: (label) => `Vô hiệu hoá ${label}?`,
    description: 'Mục này sẽ bị ẩn khỏi portal. Dữ liệu vẫn được giữ lại và bạn có thể kích hoạt lại bất cứ lúc nào.',
  },
  reactivate: {
    title: (label) => `Kích hoạt lại ${label}?`,
    description: 'Mục này sẽ hiển thị trở lại trên portal.',
  },
};

export function AdminStatusDialog({
  open,
  onOpenChange,
  mode,
  entityLabel,
  description,
  extraWarning,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'deactivate' | 'reactivate';
  entityLabel: string;
  description?: string | { deactivate?: string; reactivate?: string };
  extraWarning?: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const defaultCopy = COPY[mode];
  const customDesc = typeof description === 'string' ? description : description?.[mode];
  const finalDescription = customDesc ?? defaultCopy.description;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{defaultCopy.title(entityLabel)}</AlertDialogTitle>
          <AlertDialogDescription>
            {finalDescription}
            {extraWarning && (
              <>
                <br />
                <br />
                {extraWarning}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Huỷ</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            Xác nhận
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
