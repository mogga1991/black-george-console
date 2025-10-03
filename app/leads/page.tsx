'use client';

import { ProtectedRoute } from '@/components/protected-route';

export default function LeadsPage() {
  return (
    <ProtectedRoute>
      <div className="flex-1 p-6 bg-white h-full overflow-auto">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Leads</h1>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600">Leads page coming soon...</p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}