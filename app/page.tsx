'use client';

import { SidebarApp } from "@/components/ui/sidebar-app";
import { AIChat } from "@/components/chat/AIChat";
import { MapCanvas } from "@/components/map/MapCanvas";
import { useMapOverlay } from "@/components/map/useMapOverlay";
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { Property } from "@/lib/types";
import { Map } from "mapbox-gl";
import { useRef, useState } from "react";

export default function Page() {
  const { signOut } = useAuth();
  const router = useRouter();
  const mapRef = useRef<Map | null>(null);
  const [results, setResults] = useState<Property[]>([]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleResults = (items: Property[]) => {
    setResults(items);
    const map = mapRef.current;
    if (!map) return;
    
    const { render } = useMapOverlay(map);
    render(items, { focusFirst: true });
  };

  return (
    <ProtectedRoute>
      <main className="h-[100dvh] flex bg-neutral-50">
        {/* Brand sidebar (collapsible) */}
        <SidebarApp
          pageName="CRE Console"
          onLogout={handleLogout}
        />

        {/* 2-pane content: Chat | Map */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] h-full">
          {/* AI Chat */}
          <AIChat onResults={handleResults} />

          {/* Map */}
          <MapCanvas
            onReady={(map) => {
              mapRef.current = map;
            }}
          />
        </div>
      </main>
    </ProtectedRoute>
  );
}