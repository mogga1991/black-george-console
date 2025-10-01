import './globals.css';
import { ReactNode } from 'react';

export const metadata = { title: 'CRE Console', description: 'Internal leads & opportunities' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl p-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">CRE Console</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:underline">Dashboard</a>
              <a href="/leads" className="hover:underline">Leads</a>
              <a href="/opportunities" className="hover:underline">Opportunities</a>
              <a href="/properties" className="hover:underline">Properties</a>
              <a href="/imports" className="hover:underline">Imports</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
