import './globals.css';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth/context';

export const metadata = { 
  title: 'ब्लैक जॉर्ज', 
  description: 'Business Management Platform' 
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: 'white', minHeight: '100vh' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}