"use client";

import { useEffect, useRef, useState } from "react";

// Google Maps API key - update this in your environment variables
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyAe58WUHYvNaCLKJOReaTdy-UavTU3IEr0";

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function GoogleMapCanvas({ onReady }: { onReady?: (map: any) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;

    window.initMap = () => {
      setIsLoaded(true);
      initializeMap();
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window.initMap;
    };
  }, []);

  const initializeMap = () => {
    if (!containerRef.current || !window.google) return;

    const mapInstance = new window.google.maps.Map(containerRef.current, {
      center: { lat: 39.8283, lng: -98.5795 }, // Center of United States
      zoom: 4,
      mapTypeId: 'roadmap',
      styles: [
        {
          "featureType": "all",
          "elementType": "geometry.fill",
          "stylers": [
            {
              "weight": "2.00"
            }
          ]
        },
        {
          "featureType": "all",
          "elementType": "geometry.stroke",
          "stylers": [
            {
              "color": "#9c9c9c"
            }
          ]
        },
        {
          "featureType": "all",
          "elementType": "labels.text",
          "stylers": [
            {
              "visibility": "on"
            }
          ]
        },
        {
          "featureType": "landscape",
          "elementType": "all",
          "stylers": [
            {
              "color": "#f2f2f2"
            }
          ]
        },
        {
          "featureType": "landscape",
          "elementType": "geometry.fill",
          "stylers": [
            {
              "color": "#ffffff"
            }
          ]
        },
        {
          "featureType": "landscape.man_made",
          "elementType": "geometry.fill",
          "stylers": [
            {
              "color": "#ffffff"
            }
          ]
        },
        {
          "featureType": "poi",
          "elementType": "all",
          "stylers": [
            {
              "visibility": "off"
            }
          ]
        },
        {
          "featureType": "road",
          "elementType": "all",
          "stylers": [
            {
              "saturation": -100
            },
            {
              "lightness": 45
            }
          ]
        },
        {
          "featureType": "road",
          "elementType": "geometry.fill",
          "stylers": [
            {
              "color": "#eeeeee"
            }
          ]
        },
        {
          "featureType": "road",
          "elementType": "labels.text.fill",
          "stylers": [
            {
              "color": "#7b7b7b"
            }
          ]
        },
        {
          "featureType": "road",
          "elementType": "labels.text.stroke",
          "stylers": [
            {
              "color": "#ffffff"
            }
          ]
        },
        {
          "featureType": "road.highway",
          "elementType": "all",
          "stylers": [
            {
              "visibility": "simplified"
            }
          ]
        },
        {
          "featureType": "road.arterial",
          "elementType": "labels.icon",
          "stylers": [
            {
              "visibility": "off"
            }
          ]
        },
        {
          "featureType": "transit",
          "elementType": "all",
          "stylers": [
            {
              "visibility": "off"
            }
          ]
        },
        {
          "featureType": "water",
          "elementType": "all",
          "stylers": [
            {
              "color": "#46bcec"
            },
            {
              "visibility": "on"
            }
          ]
        },
        {
          "featureType": "water",
          "elementType": "geometry.fill",
          "stylers": [
            {
              "color": "#c8d7d4"
            }
          ]
        },
        {
          "featureType": "water",
          "elementType": "labels.text.fill",
          "stylers": [
            {
              "color": "#070707"
            }
          ]
        },
        {
          "featureType": "water",
          "elementType": "labels.text.stroke",
          "stylers": [
            {
              "color": "#ffffff"
            }
          ]
        }
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy', // Better mobile touch handling
      clickableIcons: false, // Reduce accidental clicks on mobile
    });

    // Add major metropolitan areas as circle overlays
    const metroAreas = [
      // Tier 1 Markets (Primary)
      { center: { lat: 40.7128, lng: -74.0060 }, name: 'New York', class: 'tier1' },
      { center: { lat: 34.0522, lng: -118.2437 }, name: 'Los Angeles', class: 'tier1' },
      { center: { lat: 41.8781, lng: -87.6298 }, name: 'Chicago', class: 'tier1' },
      { center: { lat: 37.7749, lng: -122.4194 }, name: 'San Francisco', class: 'tier1' },
      { center: { lat: 38.9072, lng: -77.0369 }, name: 'Washington DC', class: 'tier1' },
      { center: { lat: 42.3601, lng: -71.0589 }, name: 'Boston', class: 'tier1' },
      { center: { lat: 33.7490, lng: -84.3880 }, name: 'Atlanta', class: 'tier1' },
      { center: { lat: 25.7617, lng: -80.1918 }, name: 'Miami', class: 'tier1' },

      // Tier 2 Markets (Secondary)
      { center: { lat: 29.7604, lng: -95.3698 }, name: 'Houston', class: 'tier2' },
      { center: { lat: 33.4484, lng: -112.0740 }, name: 'Phoenix', class: 'tier2' },
      { center: { lat: 39.9526, lng: -75.1652 }, name: 'Philadelphia', class: 'tier2' },
      { center: { lat: 32.7767, lng: -96.7970 }, name: 'Dallas', class: 'tier2' },
      { center: { lat: 47.6062, lng: -122.3321 }, name: 'Seattle', class: 'tier2' },
      { center: { lat: 39.7392, lng: -104.9903 }, name: 'Denver', class: 'tier2' },
      { center: { lat: 42.3314, lng: -83.0458 }, name: 'Detroit', class: 'tier2' },
      { center: { lat: 36.1627, lng: -86.7816 }, name: 'Nashville', class: 'tier2' },
      { center: { lat: 36.1699, lng: -115.1398 }, name: 'Las Vegas', class: 'tier2' },
      { center: { lat: 44.9778, lng: -93.2650 }, name: 'Minneapolis', class: 'tier2' },

      // Tier 3 Markets (Tertiary)
      { center: { lat: 30.3322, lng: -81.6557 }, name: 'Jacksonville', class: 'tier3' },
      { center: { lat: 35.2271, lng: -80.8431 }, name: 'Charlotte', class: 'tier3' },
      { center: { lat: 39.7684, lng: -86.1581 }, name: 'Indianapolis', class: 'tier3' },
      { center: { lat: 45.5152, lng: -122.6784 }, name: 'Portland', class: 'tier3' },
      { center: { lat: 35.4676, lng: -97.5164 }, name: 'Oklahoma City', class: 'tier3' },
      { center: { lat: 38.2527, lng: -85.7585 }, name: 'Louisville', class: 'tier3' },
      { center: { lat: 43.0389, lng: -87.9065 }, name: 'Milwaukee', class: 'tier3' },
      { center: { lat: 39.0997, lng: -94.5786 }, name: 'Kansas City', class: 'tier3' },
      { center: { lat: 41.4993, lng: -81.6944 }, name: 'Cleveland', class: 'tier3' },
      { center: { lat: 35.7796, lng: -78.6382 }, name: 'Raleigh', class: 'tier3' }
    ];

    // Add circles for each metro area
    metroAreas.forEach(area => {
      const circle = new window.google.maps.Circle({
        strokeColor: area.class === 'tier1' ? '#3b82f6' : area.class === 'tier2' ? '#10b981' : '#f59e0b',
        strokeOpacity: 0.4,
        strokeWeight: 1,
        fillColor: area.class === 'tier1' ? '#60a5fa' : area.class === 'tier2' ? '#34d399' : '#fbbf24',
        fillOpacity: area.class === 'tier1' ? 0.15 : area.class === 'tier2' ? 0.12 : 0.1,
        map: mapInstance,
        center: area.center,
        radius: area.class === 'tier1' ? 100000 : area.class === 'tier2' ? 80000 : 60000, // radius in meters
      });

      // Add info window for tier 1 markets
      if (area.class === 'tier1') {
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; text-align: center;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;">${area.name}</h3>
              <span style="
                background: #3b82f6;
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
              ">
                Tier 1 Market
              </span>
            </div>
          `
        });

        circle.addListener('click', () => {
          infoWindow.setPosition(area.center);
          infoWindow.open(mapInstance);
        });
      }
    });

    setMap(mapInstance);
    onReady?.(mapInstance);
  };

  return <div ref={containerRef} className="h-1/2 lg:h-full w-full bg-transparent" style={{ background: 'transparent' }} />;
}