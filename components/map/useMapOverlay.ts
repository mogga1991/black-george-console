"use client";

import mapboxgl, { Map, Marker, Popup } from "mapbox-gl";
import { Property } from "@/lib/types";

export function focusTo(map: Map, lng: number, lat: number, zoom = 13) {
  map.flyTo({ center: [lng, lat], zoom, speed: 0.8, curve: 1.42, essential: true });
}

export function useMapOverlay(map: Map | null) {
  let markers: Marker[] = [];

  function clear() {
    markers.forEach((m) => m.remove());
    markers = [];
  }

  function render(props: Property[], options?: { focusFirst?: boolean }) {
    if (!map) return;
    clear();

    props.forEach((p, idx) => {
      const el = document.createElement("div");
      el.className =
        "rounded-full bg-[#053771] text-white text-xs px-2 py-1 shadow-md cursor-pointer hover:bg-[#042a57] transition-colors";
      el.textContent = String(idx + 1);

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(`
        <div class="rounded-xl bg-white shadow-lg border border-neutral-200 p-3 w-[260px]">
          <div class="flex gap-3">
            <img src="${p.imageUrl ?? ""}" class="h-12 w-12 rounded-md object-cover" onerror="this.style.display='none'" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm truncate">${p.title}</div>
              <div class="text-xs text-neutral-500 truncate">${p.address}</div>
              <div class="text-xs mt-1 text-neutral-600">${p.sqft.toLocaleString()} sf · ${p.tags?.slice(0,2).join(" · ") ?? ""}</div>
              ${p.priceMonthly ? `<div class="text-xs font-medium text-green-600 mt-1">$${p.priceMonthly.toLocaleString()}/mo</div>` : ''}
            </div>
          </div>
        </div>
      `);

      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([p.coords.lng, p.coords.lat])
        .setPopup(popup)
        .addTo(map);

      markers.push(m);
    });

    if (options?.focusFirst && props[0]) {
      const c = props[0].coords;
      focusTo(map, c.lng, c.lat, 13);
    }
  }

  return { render, clear };
}