import { NextRequest, NextResponse } from "next/server";
import { RfpCriteria } from "@/lib/types";
import { aiExtractionService } from "@/lib/services/ai-extraction-service";

export const runtime = 'edge';

// Handle GET requests
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: "Enhanced RFP extraction endpoint with strict location matching. Use POST with a file to extract criteria.",
    methods: ["POST"],
    usage: "POST /api/rfp/extract with FormData containing 'file' field",
    features: ["Multi-AI fallbacks", "Strict location validation", "Government RFP optimization"]
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert file to text for processing
    const fileText = await file.text();
    
    console.log(`🔄 Processing RFP document: ${file.name} (${fileText.length} characters)`);
    
    // Use comprehensive AI extraction service
    const extractionResult = await aiExtractionService.extractRFPRequirements(fileText, file.name);
    
    console.log(`📋 Extraction completed with ${extractionResult.confidence * 100}% confidence using ${extractionResult.extractionMethod}`);
    
    if (extractionResult.warnings.length > 0) {
      console.log('⚠️ Extraction warnings:', extractionResult.warnings);
    }

    // Convert to legacy RfpCriteria format for backward compatibility
    const criteria: RfpCriteria = {
      locationText: extractionResult.criteria.locationText,
      center: extractionResult.criteria.center,
      radiusKm: extractionResult.criteria.radiusKm,
      minSqft: extractionResult.criteria.minSqft,
      maxSqft: extractionResult.criteria.maxSqft,
      leaseType: extractionResult.criteria.leaseType,
      buildingTypes: extractionResult.criteria.buildingTypes,
      tenancyType: extractionResult.criteria.tenancyType,
      maxRatePerSqft: extractionResult.criteria.maxRatePerSqft,
      mustHaves: extractionResult.criteria.mustHaves,
      niceToHaves: extractionResult.criteria.niceToHaves,
      notes: extractionResult.criteria.notes
    };

    return NextResponse.json({ 
      criteria,
      extractionMethod: extractionResult.extractionMethod,
      confidence: extractionResult.confidence,
      warnings: extractionResult.warnings,
      locationData: extractionResult.locationData, // Additional location intelligence
      strictLocation: extractionResult.locationData.strictLocation
    });

  } catch (error) {
    console.error("🚨 RFP extraction error:", error);
    return NextResponse.json(
      { error: "Failed to process document", details: error.message },
      { status: 500 }
    );
  }
}

// Fallback extraction using text patterns
function extractBasicInfo(text: string, filename: string): RfpCriteria {
  const upperText = text.toUpperCase();
  
  // Extract location information
  const stateMatch = text.match(/\b([A-Z]{2})\b/g);
  const cityMatch = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*[A-Z]{2}/);
  
  // Extract square footage
  const sqftMatches = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:SQUARE FEET|SQ\.?\s*FT\.?|SF)/gi);
  const sqftNumbers = sqftMatches?.map(match => 
    parseInt(match.replace(/[^\d]/g, ''))
  ).filter(num => num > 0).sort((a, b) => a - b) || [];

  // Extract rate information
  const rateMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*(?:PER|\/)\s*(?:SQ\.?\s*FT\.?|SF)/i);
  
  return {
    locationText: cityMatch?.[0] || "Location extracted from document",
    center: { lng: -98.5795, lat: 39.8283 }, // Default to US center
    radiusKm: 25, // Default 25km radius
    minSqft: sqftNumbers[0] || 1000,
    maxSqft: sqftNumbers[sqftNumbers.length - 1] || sqftNumbers[0] || 10000,
    leaseType: upperText.includes('FULL SERVICE') ? 'full-service' : 
               upperText.includes('NNN') || upperText.includes('NET') ? 'triple-net' : 'full-service',
    mustHaves: extractRequirements(text, ['PARKING', 'ELEVATOR', 'ADA', 'HVAC']),
    niceToHaves: extractRequirements(text, ['FITNESS', 'CAFETERIA', 'CONFERENCE']),
    notes: `Basic extraction from: ${filename}`
  };
}

// Helper to extract requirements
function extractRequirements(text: string, keywords: string[]): string[] {
  const upperText = text.toUpperCase();
  return keywords.filter(keyword => upperText.includes(keyword));
}