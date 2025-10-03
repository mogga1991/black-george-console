'use client';

import { ProtectedRoute } from '@/components/protected-route';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <div className="flex-1 bg-white h-full">
        {/* Blank page - Settings */}
      </div>
    </ProtectedRoute>
  );
}
