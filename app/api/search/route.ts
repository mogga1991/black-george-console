import { NextRequest, NextResponse } from "next/server";
import { Property, SearchRequest } from "@/lib/types";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchRequest;
  const { criteria } = body;

  // TODO: replace with your DB + vector search
  const mock: Property[] = [
    {
      id: "p1",
      title: "Market Center — Suite 1200",
      address: "1355 Market St, San Francisco, CA",
      coords: { lng: -122.4192, lat: 37.7764 },
      imageUrl:
        "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=800&q=60",
      sqft: 3200,
      priceMonthly: 15400,
      rating: 4.8,
      tags: ["near transit", "class A"],
      broker: { name: "Andrea Schmidt", email: "andrea@broker.com" },
      summary:
        "South-facing views, 12' ceilings, build-to-suit, steps to BART.",
    },
    {
      id: "p2",
      title: "SOMA Creative Loft",
      address: "650 Townsend St, San Francisco, CA",
      coords: { lng: -122.4036, lat: 37.7702 },
      imageUrl:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=60",
      sqft: 1800,
      priceMonthly: 8900,
      rating: 4.5,
      tags: ["pet friendly", "open plan"],
      broker: { name: "Liam Patel" },
      summary: "Open plan creative loft with polished concrete and skylights.",
    },
    {
      id: "p3",
      title: "Financial District Corner Office",
      address: "555 California St, San Francisco, CA",
      coords: { lng: -122.4044, lat: 37.7928 },
      imageUrl:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=60",
      sqft: 2800,
      priceMonthly: 12600,
      rating: 4.7,
      tags: ["class A", "views", "parking"],
      broker: { name: "Sarah Chen", email: "sarah@fidibroker.com" },
      summary: "Corner unit with bay views, executive finishes, and dedicated parking.",
    },
    {
      id: "p4",
      title: "Mission Bay Tech Space",
      address: "1700 Owens St, San Francisco, CA",
      coords: { lng: -122.3894, lat: 37.7697 },
      imageUrl:
        "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=800&q=60",
      sqft: 4200,
      priceMonthly: 18900,
      rating: 4.6,
      tags: ["tech ready", "modern", "cafeteria"],
      broker: { name: "Mike Rodriguez" },
      summary: "Modern tech space with fiber, collaboration areas, and on-site dining.",
    },
  ];

  return NextResponse.json({ results: mock });
}