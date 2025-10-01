import './globals.css';
import { ReactNode } from 'react';

export const metadata = { 
  title: 'CRE Console', 
  description: 'Commercial Real Estate Platform' 
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: 'white', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}