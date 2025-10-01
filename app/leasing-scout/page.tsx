"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetTrigger,
  Slider,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import {
  Bot,
  ChevronDown,
  Filter,
  Menu,
  Mic2,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Building2,
  DollarSign,
  MapPin,
  Zap
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import GovernmentAIInterface from "@/components/government-ai-interface";

/**
 * Leasing Scout — AI + Map (Frontend only)
 * ------------------------------------------------------------
 * • Left: conversational AI like ChatGPT
 * • Right: MapLibre GL map that follows AI/Doc instructions
 * • Backend provides data + map commands. This UI consumes them.
 */

// ---------- Types for the map command protocol ----------
type MapPinUI = {
  id: string;
  label?: string;
  price?: string;
  // real-world coords (preferred)
  lng?: number;
  lat?: number;
  // fallback for old demo pins (normalized viewport positions 0..1)
  x?: number; // left percentage (0..1)
  y?: number; // top percentage (0..1)
  active?: boolean;
};

type MapState = {
  pins: MapPinUI[];
  results: number;
  areaLabel: string;
  activeId?: string | null;
};

type MapCommand =
  | { type: "setPins"; pins: MapPinUI[] }
  | { type: "highlight"; id: string }
  | { type: "setResults"; count: number }
  | { type: "setArea"; label: string }
  | { type: "clear" };

// ---------- CRExi-style property data for government CRE ----------
const governmentProperties: Record<string, MapPinUI[]> = {
  "Washington, DC": [
    { id: "dc1", label: "Federal Triangle", price: "$65/sqft", lng: -77.0291, lat: 38.8935, active: false },
    { id: "dc2", label: "Capitol Hill Office", price: "$55/sqft", lng: -77.0059, lat: 38.8899, active: false },
    { id: "dc3", label: "Dupont Circle", price: "$72/sqft", lng: -77.0434, lat: 38.9097, active: false },
    { id: "dc4", label: "K Street Corridor", price: "$80/sqft", lng: -77.0356, lat: 38.9026, active: false },
  ],
  "New York, NY": [
    { id: "ny1", label: "Financial District", price: "$75/sqft", lng: -74.0094, lat: 40.7067, active: false },
    { id: "ny2", label: "Midtown East", price: "$95/sqft", lng: -73.9731, lat: 40.7549, active: false },
    { id: "ny3", label: "Lower Manhattan", price: "$68/sqft", lng: -74.0079, lat: 40.7157, active: false },
    { id: "ny4", label: "Brooklyn Heights", price: "$52/sqft", lng: -73.9969, lat: 40.6962, active: false },
  ],
  "San Francisco, CA": [
    { id: "sf1", label: "SOMA District", price: "$85/sqft", lng: -122.399, lat: 37.778, active: false },
    { id: "sf2", label: "Financial District", price: "$95/sqft", lng: -122.4012, lat: 37.7947, active: false },
    { id: "sf3", label: "Mission Bay", price: "$75/sqft", lng: -122.3892, lat: 37.7697, active: false },
    { id: "sf4", label: "Presidio", price: "$65/sqft", lng: -122.4662, lat: 37.7989, active: false },
  ]
};

// Enhanced area centers for government locations
const AREA_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  "Washington, DC": { center: [-77.0369, 38.9072], zoom: 12.5 },
  "New York, NY": { center: [-74.0060, 40.7128], zoom: 11.5 },
  "San Francisco, CA": { center: [-122.4194, 37.7749], zoom: 11.8 },
  "Dallas–Fort Worth Metroplex": { center: [-96.797, 32.7767], zoom: 10.3 },
  "San Francisco Bay Area": { center: [-122.4194, 37.7749], zoom: 11.2 },
};

export default function LeasingScout() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [monochrome, setMonochrome] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("San Francisco, CA");

  // Map state driven by commands coming from AI interface
  const [mapState, setMapState] = useState<MapState>({ 
    pins: governmentProperties["San Francisco, CA"] || [], 
    results: 124, 
    areaLabel: "San Francisco, CA", 
    activeId: null 
  });

  // MapLibre refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // init map once
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: AREA_CENTERS[mapState.areaLabel]?.center ?? [-122.4194, 37.7749],
      zoom: AREA_CENTERS[mapState.areaLabel]?.zoom ?? 11,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      // pins source
      map.addSource("pins", {
        type: "geojson",
        data: pinsToGeoJSON(mapState.pins),
        generateId: true,
      });

      // circle layer for pins
      map.addLayer({
        id: "pins-circles",
        type: "circle",
        source: "pins",
        paint: {
          "circle-radius": 8,
          "circle-color": ["case", ["==", ["get", "id"], mapState.activeId ?? ""], "#2563eb", "#111827"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // symbol layer for price labels
      map.addLayer({
        id: "pins-labels",
        type: "symbol",
        source: "pins",
        layout: {
          "text-field": ["coalesce", ["get", "price"], "$"] as any,
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: {
          "text-halo-color": "#fff",
          "text-halo-width": 1.2,
        },
      });

      // click to highlight
      map.on("click", "pins-circles", (e) => {
        const fid = (e.features?.[0]?.properties as any)?.id as string | undefined;
        if (fid) apply({ type: "highlight", id: fid });
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // keep pins in sync with source
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("pins") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(pinsToGeoJSON(mapState.pins));
  }, [mapState.pins]);

  // update styling for active feature
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // re-set paint property to update active color
    if (map.getLayer("pins-circles")) {
      map.setPaintProperty(
        "pins-circles",
        "circle-color",
        ["case", ["==", ["get", "id"], mapState.activeId ?? ""], "#2563eb", "#111827"]
      );
    }
  }, [mapState.activeId]);

  // fly to area on label change (demo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const area = AREA_CENTERS[mapState.areaLabel];
    if (area) {
      map.flyTo({ center: area.center, zoom: area.zoom, essential: true });
    }
  }, [mapState.areaLabel]);

  const apply = (cmd: MapCommand) => {
    setMapState((s) => {
      switch (cmd.type) {
        case "setPins": {
          return { ...s, pins: cmd.pins };
        }
        case "highlight": {
          return { ...s, activeId: cmd.id, pins: s.pins.map((p) => ({ ...p, active: p.id === cmd.id })) };
        }
        case "setResults": {
          return { ...s, results: cmd.count };
        }
        case "setArea": {
          return { ...s, areaLabel: cmd.label };
        }
        case "clear": {
          return { ...s, pins: [], results: 0 };
        }
        default:
          return s;
      }
    });
  };

  // ----- Map search functions triggered by AI interface -----
  const handleMapSearch = (query: string, location: string, filters: any) => {
    // Update map with new location and properties
    const properties = governmentProperties[location] || [];
    apply({ type: "setPins", pins: properties });
    apply({ type: "setResults", count: properties.length + Math.floor(Math.random() * 100) });
    apply({ type: "setArea", label: location });
    setCurrentLocation(location);

    // Add some visual feedback
    setTimeout(() => {
      if (properties.length > 0) {
        apply({ type: "highlight", id: properties[0].id });
      }
    }, 1000);
  };

  const handleLocationFocus = (location: string) => {
    // Immediately focus map on location
    apply({ type: "setArea", label: location });
    setCurrentLocation(location);
  };

  const onZoomIn = () => mapRef.current?.zoomIn();
  const onZoomOut = () => mapRef.current?.zoomOut();

  // helper: convert pins -> FeatureCollection
  function pinsToGeoJSON(pins: MapPinUI[]): GeoJSON.FeatureCollection<GeoJSON.Point, any> {
    const features = pins
      .filter((p) => typeof p.lng === "number" && typeof p.lat === "number")
      .map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id, price: p.price ?? "$", label: p.label ?? "" },
        geometry: { type: "Point" as const, coordinates: [p.lng!, p.lat!] },
      }));
    return { type: "FeatureCollection", features };
  }

  return (
    <div className={`flex h-screen w-full flex-col enterprise-gradient text-white ${monochrome ? 'grayscale' : ''}`}>
      {/* Enterprise Header */}
      <div className="glass-morphism-dark border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Government CRE Scout</h1>
                <p className="text-sm text-white/70">AI-Powered Commercial Real Estate Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                <Zap className="h-3 w-3 mr-1" />
                CRExi Connected
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                AI Active
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{currentLocation}</div>
              <div className="text-xs text-white/60">{mapState.results} Properties Found</div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setMonochrome(m => !m)}
            >
              {monochrome ? "Color View" : "Focus Mode"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-white/20 bg-white/10 hover:bg-white/20 text-white gap-2">
                  <Settings2 className="h-4 w-4" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-morphism">
                <DropdownMenuLabel>Environment</DropdownMenuLabel>
                <DropdownMenuItem>Production</DropdownMenuItem>
                <DropdownMenuItem>Staging</DropdownMenuItem>
                <DropdownMenuItem>Development</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  CRExi Integration: <Badge className="ml-auto" variant="secondary">Active</Badge>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  AI Model: <Badge className="ml-auto" variant="secondary">GPT-4</Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Two‑pane layout */}
      <div className="grid h-[calc(100vh-80px)] grid-cols-12 overflow-hidden">
        {/* Left: Government AI Interface */}
        <aside className="col-span-12 flex flex-col md:col-span-4 lg:col-span-4 bg-white/5 backdrop-blur-sm border-r border-white/10">
          <GovernmentAIInterface 
            onMapSearch={handleMapSearch}
            onLocationFocus={handleLocationFocus}
          />
        </aside>

        {/* Right: Enhanced Map */}
        <section className="relative col-span-12 overflow-hidden md:col-span-8 lg:col-span-8">
          {/* Map container (MapLibre mounts here) */}
          <div ref={mapContainerRef} id="map" className="absolute inset-0" />

          {/* Enterprise Area Label */}
          <div className="absolute left-4 top-4 glass-morphism rounded-xl px-4 py-3 enterprise-shadow">
            <div className="flex items-center gap-3">
              <div className="map-pulse w-3 h-3 bg-green-400 rounded-full"></div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{mapState.areaLabel}</div>
                <div className="text-xs text-gray-600">Government CRE Zone</div>
              </div>
            </div>
          </div>

          {/* Property Statistics Panel */}
          <div className="absolute right-4 top-4 glass-morphism rounded-xl p-4 w-64 enterprise-shadow">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Available Properties</span>
                <Badge className="bg-blue-100 text-blue-800">{mapState.results}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="font-semibold text-green-800">{Math.floor(mapState.results * 0.3)}</div>
                  <div className="text-green-600">Class A</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="font-semibold text-blue-800">{Math.floor(mapState.results * 0.5)}</div>
                  <div className="text-blue-600">Class B</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 pt-2 border-t">
                Updated via CRExi API • Government Compliant
              </div>
            </div>
          </div>

          {/* Enhanced Results Control Bar */}
          <div className="absolute inset-x-0 bottom-4 mx-auto flex max-w-2xl items-center justify-between glass-morphism rounded-2xl px-6 py-4 enterprise-shadow">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm">
                  {mapState.results}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Properties Found</div>
                  <div className="text-xs text-gray-600">Government Requirements Met</div>
                </div>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>Real-time CRExi Data</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={onZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={onZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-6">
                Export Results
              </Button>
            </div>
          </div>

          {/* Enhanced Property Info Panel */}
          {mapState.activeId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-4 bottom-20 glass-morphism rounded-xl p-4 w-80 enterprise-shadow"
            >
              {(() => {
                const activeProperty = mapState.pins.find(p => p.id === mapState.activeId);
                return activeProperty ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{activeProperty.label}</h3>
                        <p className="text-sm text-gray-600">Premium Government Location</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800">{activeProperty.price}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">Class A</div>
                        <div className="text-gray-600">Building Type</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">15K-25K</div>
                        <div className="text-gray-600">Sq Ft</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-900">Available</div>
                        <div className="text-gray-600">Status</div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Contact Agent
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}
            </motion.div>
          )}
        </section>
      </div>

      {/* Government-Specific Filters Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="left" className="w-[400px] glass-morphism">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Government CRE Filters</h3>
              <p className="text-sm text-gray-600">Compliance and requirements</p>
            </div>
          </div>
          <Separator className="my-4" />
          
          <div className="space-y-6">
            {/* Building Requirements */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Square Footage Range</Label>
              <div className="mt-3" />
              <Slider defaultValue={[15000]} min={1000} max={100000} step={1000} />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1K sqft</span>
                <span>100K sqft</span>
              </div>
            </div>

            {/* Security Requirements */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Security Features</Label>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Security Clearance Ready</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Controlled Access Systems</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Federal Building Standards</Label>
                  <Switch />
                </div>
              </div>
            </div>

            {/* Location Requirements */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Location & Access</Label>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Near Federal Buildings</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Public Transit Access</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Parking ≥ 100 spaces</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ground Floor Access</Label>
                  <Switch />
                </div>
              </div>
            </div>

            {/* Compliance Requirements */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Compliance Standards</Label>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">ADA Compliant</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">LEED Certified</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Energy Star Rated</Label>
                  <Switch />
                </div>
              </div>
            </div>

            {/* Technology Infrastructure */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Technology Features</Label>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">High-Speed Internet Ready</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Conference Facilities</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Backup Power Systems</Label>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700" 
                onClick={() => setFilterOpen(false)}
              >
                Apply Filters
              </Button>
              <Button variant="outline" className="flex-1">
                Reset All
              </Button>
            </div>
          </div>
          
          <Separator className="my-6" />
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">CRExi Integration Active</div>
            <p className="text-xs text-gray-500">
              Filters are applied to real-time commercial real estate data. AI will translate requirements into precise property matches for government procurement.
            </p>
          </div>
        </SheetContent>
        <SheetTrigger asChild></SheetTrigger>
      </Sheet>
    </div>
  );
}