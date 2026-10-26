import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthLogin, useAuthLogout } from '@/lib/api/generated/auth/auth';
import type { LoginFormValues } from '@/lib/auth/auth-schemas';

export function useAuthActions() {
  const loginMutation = useAuthLogin();
  const logoutMutation = useAuthLogout();
  const queryClient = useQueryClient();
  const router = useRouter();

  const login = async (dto: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync({ data: dto });
      queryClient.clear();
      toast.success('Đăng nhập thành công');
      router.push('/sap/monitor-ban');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const message =
        raw === 'Invalid email or password'
          ? 'Email hoặc mật khẩu không chính xác.'
          : raw || 'Đăng nhập thất bại.';
      toast.error(message);
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Best-effort cleanup
    }
    queryClient.clear();
    router.push('/login');
  };

  return { login, logout, isPending: loginMutation.isPending };
}
