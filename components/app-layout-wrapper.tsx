'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarApp } from '@/components/ui/sidebar-app';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';

interface AppLayoutWrapperProps {
  children: ReactNode;
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const router = useRouter();

  // Pages that should not have the sidebar
  const noSidebarPages = ['/login', '/auth/callback'];
  const shouldShowSidebar = user && !noSidebarPages.includes(pathname);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (!shouldShowSidebar) {
    return <>{children}</>;
  }

  return (
    <main className="h-[100dvh] flex bg-neutral-50">
      <SidebarApp
        pageName="CRE Console"
        onLogout={handleLogout}
      />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </main>
  );
}