export type RfpCriteria = {
  locationText?: string;       // e.g., "San Francisco Bay Area"
  center?: { lng: number; lat: number };
  radiusKm?: number;
  minSqft?: number;
  maxSqft?: number;
  floors?: number;
  leaseType?: "full-service" | "modified-gross" | "triple-net" | "unknown";
  budgetMonthly?: number;      // USD
  timing?: { earliest: string; latest?: string };
  mustHaves?: string[];        // ["pet friendly", "parking 2/1000", "BART"]
  niceToHaves?: string[];
  notes?: string;
};

export type Property = {
  id: string;
  title: string;
  address: string;
  coords: { lng: number; lat: number };
  imageUrl?: string;
  sqft: number;
  priceMonthly?: number;
  rating?: number;
  tags?: string[];
  broker?: { name: string; phone?: string; email?: string };
  summary?: string;            // 1–2 sentence highlight
};

export type ChatMessage =
  | { id: string; role: "user"; text: string; files?: File[] }
  | { id: string; role: "assistant"; text?: string; cards?: Property[]; chips?: string[] };

export type SearchRequest = { criteria: RfpCriteria; topK?: number };
export type SearchResponse = { results: Property[] };