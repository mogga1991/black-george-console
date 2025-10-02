import { NextRequest, NextResponse } from "next/server";
import { RfpCriteria } from "@/lib/types";

export async function POST(req: NextRequest) {
  // NOTE: parse FormData with the file field "file"
  const form = await req.formData();
  const file = form.get("file") as File | null;

  // TODO: replace with real extractor (Claude or server)
  const mock: RfpCriteria = {
    locationText: "San Francisco, CA",
    center: { lng: -122.4194, lat: 37.7749 },
    radiusKm: 10,
    minSqft: 1000,
    maxSqft: 5000,
    leaseType: "full-service",
    mustHaves: ["near transit", "pet friendly"],
    niceToHaves: ["parking", "fitness"],
    notes: file ? `Parsed: ${file.name}` : undefined,
  };

  return NextResponse.json({ criteria: mock });
}