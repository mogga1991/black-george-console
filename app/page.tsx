'use client';

import { AIChat } from "@/components/chat/AIChat";
import { GoogleMapCanvas } from "@/components/map/GoogleMapCanvas";
import { useGoogleMapOverlay } from "@/components/map/useGoogleMapOverlay";
import { ProtectedRoute } from '@/components/protected-route';
import { Property } from "@/lib/types";
import { useRef, useState } from "react";

export default function Page() {
  const mapRef = useRef<any | null>(null);
  const [results, setResults] = useState<Property[]>([]);

  const handleResults = (items: Property[]) => {
    setResults(items);
    const map = mapRef.current;
    if (!map) return;
    
    const { render } = useGoogleMapOverlay(map);
    render(items, { focusFirst: true });
  };

  return (
    <ProtectedRoute>
      {/* 2-pane content: Chat | Map */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[420px_1fr] h-full">
        {/* AI Chat */}
        <AIChat onResults={handleResults} />

        {/* Map */}
        <GoogleMapCanvas
          onReady={(map) => {
            mapRef.current = map;
          }}
        />
      </div>
    </ProtectedRoute>
  );
}