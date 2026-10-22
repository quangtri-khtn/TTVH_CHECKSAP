'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/sonner';
import { getQueryClient } from '@/lib/query-client';
import { AuthForbiddenProvider } from '@/features/auth/components/auth-forbidden-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthForbiddenProvider>
        {children}
        <Toaster />
        {process.env.NODE_ENV !== 'production' && <ReactQueryDevtools initialIsOpen={false} />}
      </AuthForbiddenProvider>
    </QueryClientProvider>
  );
}
