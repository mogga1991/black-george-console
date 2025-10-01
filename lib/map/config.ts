// Map Configuration for ब्लैक जॉर्ज Real Estate Platform

export interface MapConfig {
  provider: 'mapbox' | 'google' | 'leaflet';
  defaultCenter: [number, number]; // [longitude, latitude]
  defaultZoom: number;
  maxZoom: number;
  minZoom: number;
  style: string;
  apiKey?: string;
}

// Recommended: Mapbox for real estate applications
export const mapConfig: MapConfig = {
  provider: 'mapbox',
  defaultCenter: [-74.006, 40.7128], // NYC coordinates
  defaultZoom: 11, // City level view - perfect for real estate
  maxZoom: 18, // Street level detail
  minZoom: 8,  // Regional view
  style: 'mapbox://styles/mapbox/streets-v12', // Clean street view
  apiKey: process.env.NEXT_PUBLIC_MAPBOX_API_KEY || '',
};

// Alternative centers for different markets
export const marketCenters = {
  nyc: [-74.006, 40.7128],
  losAngeles: [-118.2437, 34.0522],
  chicago: [-87.6298, 41.8781],
  miami: [-80.1918, 25.7617],
  boston: [-71.0589, 42.3601],
  washingtonDC: [-77.0369, 38.9072],
  sanFrancisco: [-122.4194, 37.7749],
  seattle: [-122.3321, 47.6062],
  austin: [-97.7431, 30.2672],
  denver: [-104.9903, 39.7392],
} as const;

// Property type zoom levels
export const propertyZoomLevels = {
  neighborhood: 12,   // Overview of area
  building: 16,       // Individual buildings
  unit: 18,          // Specific units/details
} as const;

// Map themes for different property types
export const mapStyles = {
  residential: 'mapbox://styles/mapbox/streets-v12',
  commercial: 'mapbox://styles/mapbox/light-v11',
  industrial: 'mapbox://styles/mapbox/satellite-streets-v12',
  mixed: 'mapbox://styles/mapbox/outdoors-v12',
} as const;

// Utility functions
export const getMapConfig = (propertyType?: keyof typeof mapStyles) => ({
  ...mapConfig,
  style: propertyType ? mapStyles[propertyType] : mapConfig.style,
});

export const setCenterForMarket = (market: keyof typeof marketCenters) => ({
  ...mapConfig,
  defaultCenter: marketCenters[market],
});

// Authentication logout helper (works with Supabase)
export const logoutUser = async () => {
  // This integrates with your existing auth context
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
};