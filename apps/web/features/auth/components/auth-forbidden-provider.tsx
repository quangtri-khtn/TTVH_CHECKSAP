'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthGetMeQueryKey } from '@/lib/api/generated/auth/auth';

const DEBOUNCE_MS = 300;

export function AuthForbiddenProvider({ children }: { children?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleForbidden = () => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: getAuthGetMeQueryKey() });
      }, DEBOUNCE_MS);
    };

    window.addEventListener('auth:forbidden', handleForbidden);
    return () => {
      window.removeEventListener('auth:forbidden', handleForbidden);
      window.clearTimeout(timeoutRef.current);
    };
  }, [queryClient]);

  return <>{children}</>;
}
