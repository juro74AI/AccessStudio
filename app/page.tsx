'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      if (user.persona === 'manager') {
        router.replace('/dashboard');
      } else {
        router.replace('/validations');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          <span className="text-[hsl(var(--muted-foreground))]">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        <span className="text-[hsl(var(--muted-foreground))]">Redirecting...</span>
      </div>
    </div>
  );
}
