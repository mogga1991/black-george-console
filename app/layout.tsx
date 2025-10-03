import './globals.css';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/context';
import { AppLayoutWrapper } from '@/components/app-layout-wrapper';
import '@/lib/telemetry-blocker';

export const metadata = { 
  title: 'CRE Console', 
  description: 'Your console'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
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