import './globals.css';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/context';
import { AppLayoutWrapper } from '@/components/app-layout-wrapper';

export const metadata = { 
  title: 'CRE Console', 
  description: 'Your console' 
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: 'white', minHeight: '100vh' }}>
        <AuthProvider>
          <AppLayoutWrapper>
            {children}
          </AppLayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}