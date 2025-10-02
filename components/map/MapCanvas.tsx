"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoiZ292bGVhc2VzeW5jIiwiYSI6ImNtZnU5em5xbjEzcjkyb3B3OXE3dTU4YmsifQ.VG_8FTAVyaftS8xfoE4fEw";

mapboxgl.accessToken = MAPBOX_TOKEN;

export function MapCanvas({ onReady }: { onReady?: (map: Map) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<Map | null>(null);

  useEffect(() => {
    const m = new mapboxgl.Map({
      container: containerRef.current as HTMLDivElement,
      style: "mapbox://styles/mapbox/light-v11", // Clean, modern style
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 11,
    });
    
    m.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    
    m.on("load", () => {
      setMap(m);
      onReady?.(m);
    });
    
    return () => m.remove();
  }, [onReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}