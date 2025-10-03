"use client";

import { Property } from "@/lib/types";

declare global {
  interface Window {
    google: any;
  }
}

export function focusTo(map: any, lng: number, lat: number, zoom = 13) {
  map.panTo({ lat, lng });
  map.setZoom(zoom);
}

export function useGoogleMapOverlay(map: any | null) {
  let markers: any[] = [];

  function clear() {
    markers.forEach((marker) => marker.setMap(null));
    markers = [];
  }

  function render(props: Property[], options?: { focusFirst?: boolean }) {
    if (!map || !window.google) return;
    clear();

    props.forEach((p, idx) => {
      // Create custom marker element
      const markerElement = document.createElement("div");
      markerElement.className =
        "rounded-full bg-[#053771] text-white text-xs px-2 py-1 shadow-md cursor-pointer hover:bg-[#042a57] transition-colors";
      markerElement.textContent = String(idx + 1);
      markerElement.style.cssText = `
        background-color: #053771;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;

      // Create info window content
      const infoWindowContent = `
        <div style="
          border-radius: 12px;
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          padding: 12px;
          width: 260px;
        ">
          <div style="display: flex; gap: 12px;">
            <img src="${p.imageUrl ?? ""}" 
                 style="height: 48px; width: 48px; border-radius: 6px; object-fit: cover; display: ${p.imageUrl ? 'block' : 'none'};" 
                 onerror="this.style.display='none'" />
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.title}</div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.address}</div>
              <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">${p.sqft.toLocaleString()} sf · ${p.tags?.slice(0,2).join(" · ") ?? ""}</div>
              ${p.priceMonthly ? `<div style="font-size: 12px; font-weight: 500; color: #059669;">$${p.priceMonthly.toLocaleString()}/mo</div>` : ''}
            </div>
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoWindowContent,
        disableAutoPan: false,
      });

      // Create advanced marker (fallback to regular marker if AdvancedMarkerElement is not available)
      let marker;
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: p.coords.lat, lng: p.coords.lng },
          map: map,
          content: markerElement,
          title: p.title,
        });
      } else {
        // Fallback to regular marker
        marker = new window.google.maps.Marker({
          position: { lat: p.coords.lat, lng: p.coords.lng },
          map: map,
          title: p.title,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="#053771"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${idx + 1}</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 12),
          },
        });
      }

      // Add click listener to open info window
      marker.addListener("click", () => {
        // Close all other info windows first
        markers.forEach(m => m.infoWindow?.close());
        infoWindow.open(map, marker);
      });

      // Store info window reference for later cleanup
      marker.infoWindow = infoWindow;
      markers.push(marker);
    });

    if (options?.focusFirst && props[0]) {
      const c = props[0].coords;
      focusTo(map, c.lng, c.lat, 13);
    }
  }

  return { render, clear };
}