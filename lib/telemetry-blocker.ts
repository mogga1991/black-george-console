// Global telemetry blocker for Mapbox/MapLibre GL
// This prevents all telemetry requests from being sent

export function blockMapTelemetry() {
  if (typeof window === 'undefined') return;

  // Override fetch to block telemetry requests
  const originalFetch = window.fetch;
  window.fetch = function(...args: Parameters<typeof fetch>): Promise<Response> {
    const url = args[0];
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.href : '';
    
    // Block Mapbox telemetry endpoints
    if (urlString.includes('events.mapbox.com') || 
        urlString.includes('mapbox.com/events') ||
        urlString.includes('api.mapbox.com/events')) {
      // Return empty successful response
      return Promise.resolve(new Response('', { 
        status: 204,
        statusText: 'No Content',
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    
    return originalFetch.apply(this, args);
  };

  // Also override XMLHttpRequest for older requests
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
    const urlString = typeof url === 'string' ? url : url.href;
    
    if (urlString.includes('events.mapbox.com') || 
        urlString.includes('mapbox.com/events') ||
        urlString.includes('api.mapbox.com/events')) {
      // Don't open the request
      return;
    }
    
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  // Disable MapLibre telemetry at the global level
  try {
    if (typeof window !== 'undefined' && (window as any).maplibregl) {
      (window as any).maplibregl.accessToken = undefined;
    }
  } catch (e) {
    // Ignore errors
  }
}

// Initialize on import
if (typeof window !== 'undefined') {
  blockMapTelemetry();
}