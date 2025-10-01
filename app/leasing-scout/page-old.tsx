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
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

// ---------- Demo seeds (now with real lat/lng) ----------
const demoPinsSF: MapPinUI[] = [
  { id: "p1", label: "SOMA", price: "$1200", lng: -122.399, lat: 37.778 },
  { id: "p2", label: "Mission", price: "$750", lng: -122.418, lat: 37.759 },
  { id: "p3", label: "North Beach", price: "$400", lng: -122.410, lat: 37.806 },
];

// simple area centers for demo flyTo
const AREA_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  "San Francisco Bay Area": { center: [-122.4194, 37.7749], zoom: 11.2 },
  "Dallas–Fort Worth Metroplex": { center: [-96.797, 32.7767], zoom: 10.3 },
};

export default function LeasingScout() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "user", text: "Find Class‑A office space in DFW, 10–15k sq ft, near transit." },
    {
      role: "assistant",
      text:
        "Certainly! I can search for Class‑A buildings 10–15k sqft within walking distance to transit and load them on the map. Any budget or preferred submarkets?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [monochrome, setMonochrome] = useState(false);

  // Map state driven by commands coming from assistant/backend
  const [mapState, setMapState] = useState<MapState>({ pins: demoPinsSF, results: 180, areaLabel: "San Francisco Bay Area", activeId: null });

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

  // ----- Send chat message (stub). In production, call your backend -----
  const send = () => {
    if (!draft.trim()) return;
    const userText = draft;
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setDraft("");

    // Demo: simulate assistant response + map instructions from backend
    const reply =
      "I found 487 results that match. 128 are best matches (Class‑A), 263 medium, 96 light matches. Rendering top clusters on the map. Want me to filter to pet‑friendly and add parking constraints?";
    setMessages((m) => [...m, { role: "assistant", text: reply }]);

    // Demo command stream — replace with your real socket/HTTP events
    apply({ type: "setPins", pins: demoPinsSF });
    apply({ type: "setResults", count: 487 });
    apply({ type: "setArea", label: "Dallas–Fort Worth Metroplex" });
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
    <div className={`flex h-full w-full flex-col bg-white text-black ${monochrome ? 'grayscale' : ''}`}>
      {/* Main Content - No Header */}
      <div className="flex h-full">
        {/* Chat Panel */}
        <div className="flex w-96 flex-col border-r bg-gray-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-semibold tracking-tight sm:text-base">Leasing Scout</h1>
            <Badge variant="secondary">AI</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
          <Button size="sm" variant={monochrome ? "default" : "outline"} onClick={() => setMonochrome(m => !m)}>
            {monochrome ? "B/W On" : "B/W Off"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-2">
                <Settings2 className="h-4 w-4" />
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuItem>Prod</DropdownMenuItem>
              <DropdownMenuItem>Staging</DropdownMenuItem>
              <DropdownMenuItem>Dev</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Keyboard: <kbd className="ml-1 rounded border px-1">/</kbd> to focus</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Two‑pane layout */}
      <div className="grid h-[calc(100vh-44px)] grid-cols-12 overflow-hidden">
        {/* Left: Chat */}
        <aside className="col-span-12 flex flex-col border-r md:col-span-4 lg:col-span-4">
          {/* Chat header inside pane */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium">Chat</span>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setFilterOpen(true)}>
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="h-full px-3">
            <div className="space-y-3 py-2">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-start gap-2"
                >
                  <div className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full border ${m.role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <div className="text-[11px] font-bold">U</div>}
                  </div>
                  <Card className="max-w-[80%] shadow-sm">
                    <CardContent className="prose prose-sm dark:prose-invert max-w-none p-3">
                      {m.text}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t p-3">
            <div className="relative">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask for space by size, class, budget, transit…"
                className="h-12 rounded-2xl pl-10 pr-28"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Mic2 className="h-4 w-4" /></Button>
                  <Button size="icon" className="h-9 w-9" onClick={send}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Tip: Say "show only pet‑friendly with 50+ parking stalls".</span>
              <span>Ctrl/⌘ + Enter to send</span>
            </div>
          </div>

          {/* Dock */}
          <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> Search Leasing Offices
            <span className="ml-auto">AI may make mistakes. Verify details.</span>
          </div>
        </aside>

        {/* Right: Map */}
        <section className="relative col-span-12 overflow-hidden md:col-span-8 lg:col-span-8">
          {/* Map container (MapLibre mounts here) */}
          <div ref={mapContainerRef} id="map" className="absolute inset-0" />

          {/* If any legacy pins lack lat/lng, render as UI overlays (fallback) */}
          {mapState.pins
            .filter((p) => p.lng == null || p.lat == null)
            .map((p) => (
              <div
                key={p.id}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background px-2 py-1 text-xs shadow ${p.active ? "border-primary text-primary" : "text-foreground"}`}
                style={{ left: `${(p.x ?? 0.5) * 100}%`, top: `${(p.y ?? 0.5) * 100}%` }}
              >
                {p.price || "$"}
              </div>
            ))}

          {/* Area label */}
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg border bg-background/90 px-3 py-1.5 text-xs shadow">
            {mapState.areaLabel}
          </div>

          {/* Results bar */}
          <div className="absolute inset-x-0 bottom-3 mx-auto flex max-w-xl items-center justify-between rounded-xl border bg-background/95 px-3 py-2 shadow">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border">{mapState.results}</span>
              results
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onZoomOut}><ZoomOut className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={onZoomIn}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="secondary" size="sm" className="ml-1">Save Search</Button>
            </div>
          </div>

          {/* Map controls (bottom‑right) — extra buttons */}
          <div className="absolute bottom-3 right-3 flex gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => apply({ type: "highlight", id: "p1" })}><Plus className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={onZoomIn}><ZoomIn className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={onZoomOut}><ZoomOut className="h-4 w-4" /></Button>
          </div>
        </section>
      </div>

      {/* Filters Sheet (for quick constraints) */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="left" className="w-[360px]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold">Filters</h3>
          </div>
          <Separator className="my-2" />
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Square Footage</Label>
              <div className="mt-2" />
              <Slider defaultValue={[12000]} min={1000} max={100000} step={500} />
              <p className="mt-1 text-xs text-muted-foreground">Drag to set min sqft. Back end enforces exact logic.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pet‑friendly</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Parking ≥ 50 stalls</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Transit ≤ 10 min walk</Label>
              <Switch />
            </div>
            <Button className="w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
          </div>
          <Separator className="my-4" />
          <p className="text-[11px] text-muted-foreground">
            The AI will translate your natural‑language asks into precise search + map commands (see protocol in code).
          </p>
        </SheetContent>
        <SheetTrigger asChild></SheetTrigger>
      </Sheet>
    </div>
  );
}