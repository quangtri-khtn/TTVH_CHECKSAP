import { useAuthGetMe } from '@/lib/api/generated/auth/auth';
import type { UserResponseDto } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/http-client';

export function useCurrentUser(): {
  user: UserResponseDto | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError, error } = useAuthGetMe({
    query: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const user = data?.data.data;
  const isSessionLost = !user || (error instanceof ApiError && error.status === 401);

  return { user, isLoading, isError: isError && isSessionLost };
}
