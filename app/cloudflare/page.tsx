'use client';

import { CloudflareDashboard } from '@/components/cloudflare-dashboard';
import { Navigation } from '@/components/navigation';
import { ProtectedRoute } from '@/components/protected-route';

export default function CloudflarePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="container mx-auto py-8">
          <CloudflareDashboard />
        </div>
      </div>
    </ProtectedRoute>
  );
}

