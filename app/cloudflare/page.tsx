'use client';

import { CloudflareDashboard } from '@/components/cloudflare-dashboard';
import { ProtectedRoute } from '@/components/protected-route';

export default function CloudflarePage() {
  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto">
          <CloudflareDashboard />
        </div>
      </div>
    </ProtectedRoute>
  );
}

