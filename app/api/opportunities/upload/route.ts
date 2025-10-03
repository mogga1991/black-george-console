import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel (.xlsx, .xls) or CSV files.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the file based on type
    let opportunities;
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) {
      opportunities = await processExcelFile(buffer);
    } else {
      opportunities = await processCSVFile(buffer);
    }

    return NextResponse.json({
      success: true,
      opportunities,
      count: opportunities.length
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process uploaded file' },
      { status: 500 }
    );
  }
}

async function processExcelFile(buffer: Buffer) {
  try {
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    if (!jsonData || jsonData.length === 0) {
      throw new Error('Excel file appears to be empty or invalid');
    }
    
    const opportunities = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any;
      const opportunity = mapRowToOpportunity(row, i);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }
    
    return opportunities;
  } catch (error) {
    console.error('Excel processing error:', error);
    throw new Error('Failed to parse Excel file. Please ensure it has proper column headers.');
  }
}

async function processCSVFile(buffer: Buffer) {
  const csvText = buffer.toString('utf-8');
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const opportunities = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Map CSV columns to RFPOpportunity format
    const opportunity = mapRowToOpportunity(row, i);
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }

  return opportunities;
}

function mapRowToOpportunity(row: any, index: number) {
  // This function maps columns to the RFPOpportunity interface
  // It supports multiple common column name variations
  
  const opportunity = {
    id: `local-${Date.now()}-${index}`,
    solicitationNumber: getColumnValue(row, ['Solicitation Number', 'ID', 'Opportunity ID', 'RFP ID']) || `LOCAL-${index}`,
    title: getColumnValue(row, ['Title', 'Opportunity Title', 'Name', 'Project Name', 'Description']) || 'Untitled Opportunity',
    description: getColumnValue(row, ['Description', 'Synopsis', 'Details', 'Summary']) || '',
    issuingAgency: getColumnValue(row, ['Agency', 'Issuing Agency', 'Organization', 'Department']) || 'Local Agency',
    rfpType: parseRFPType(getColumnValue(row, ['Type', 'RFP Type', 'Opportunity Type'])),
    status: parseStatus(getColumnValue(row, ['Status', 'State', 'Opportunity Status'])),
    setAsideType: parseSetAsideType(getColumnValue(row, ['Set Aside', 'Set-Aside', 'Contracting Vehicle'])),
    naicsCodes: parseNAICSCodes(getColumnValue(row, ['NAICS', 'NAICS Code', 'Industry Code'])),
    
    // Location information
    placeOfPerformanceState: getColumnValue(row, ['State', 'Location State', 'Place of Performance State']),
    placeOfPerformanceCity: getColumnValue(row, ['City', 'Location City', 'Place of Performance City']),
    placeOfPerformanceZip: getColumnValue(row, ['ZIP', 'Zip Code', 'Postal Code', 'ZIP Code']),
    
    // Financial information
    estimatedValueMin: parseNumber(getColumnValue(row, ['Min Value', 'Estimated Value Min', 'Budget Min', 'Minimum Budget'])),
    estimatedValueMax: parseNumber(getColumnValue(row, ['Max Value', 'Estimated Value Max', 'Budget Max', 'Maximum Budget', 'Total Value', 'Contract Value'])),
    
    // Dates
    postedDate: parseDate(getColumnValue(row, ['Posted Date', 'Date Posted', 'Publication Date', 'Release Date'])),
    responseDueDate: parseDate(getColumnValue(row, ['Due Date', 'Response Due Date', 'Proposal Due Date', 'Deadline'])),
    
    // Space requirements
    spaceRequirements: {
      minSquareFeet: parseNumber(getColumnValue(row, ['Min Square Feet', 'Min SF', 'Minimum Space'])),
      maxSquareFeet: parseNumber(getColumnValue(row, ['Max Square Feet', 'Max SF', 'Maximum Space', 'Total Square Feet', 'Square Feet'])),
      propertyType: getColumnValue(row, ['Property Type', 'Space Type', 'Building Type', 'Facility Type'])
    },
    
    // Add location coordinates if available
    coordinates: parseCoordinates(row),
    
    // AI scoring (you can set default values or calculate based on data quality)
    commercialRealEstateScore: calculateCREScore(row),
    
    // System fields
    source: 'excel_upload',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  };

  return opportunity;
}

// Helper function to get column value with multiple possible column names
function getColumnValue(row: any, possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return String(row[name]).trim();
    }
  }
  return undefined;
}

// Parse coordinates from lat/lng columns
function parseCoordinates(row: any): { lat: number; lng: number } | undefined {
  const lat = parseNumber(getColumnValue(row, ['Latitude', 'Lat', 'Y', 'Latitude (DD)', 'lat']));
  const lng = parseNumber(getColumnValue(row, ['Longitude', 'Lng', 'Lon', 'X', 'Longitude (DD)', 'lng', 'long']));
  
  if (lat !== undefined && lng !== undefined && 
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat, lng };
  }
  return undefined;
}

function parseRFPType(value: string): 'rfp' | 'rfq' | 'ifb' | 'sources_sought' | 'presolicitation' {
  if (!value) return 'rfp';
  const lower = value.toLowerCase();
  if (lower.includes('rfq')) return 'rfq';
  if (lower.includes('ifb')) return 'ifb';
  if (lower.includes('sources')) return 'sources_sought';
  if (lower.includes('presol')) return 'presolicitation';
  return 'rfp';
}

function parseStatus(value: string): 'open' | 'closed' | 'awarded' | 'cancelled' | 'draft' {
  if (!value) return 'open';
  const lower = value.toLowerCase();
  if (lower.includes('closed')) return 'closed';
  if (lower.includes('award')) return 'awarded';
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('draft')) return 'draft';
  return 'open';
}

function parseSetAsideType(value: string): 'none' | 'small_business' | '8a' | 'hubzone' | 'wosb' | 'vosb' | 'sdvosb' {
  if (!value) return 'none';
  const lower = value.toLowerCase();
  if (lower.includes('small')) return 'small_business';
  if (lower.includes('8a')) return '8a';
  if (lower.includes('hub')) return 'hubzone';
  if (lower.includes('wosb')) return 'wosb';
  if (lower.includes('vosb')) return 'vosb';
  if (lower.includes('sdvosb')) return 'sdvosb';
  return 'none';
}

function parseNAICSCodes(value: string): string[] {
  if (!value) return ['531120']; // Default to real estate leasing
  return value.split(/[,;|]/).map(code => code.trim()).filter(code => code);
}

function parseNumber(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

function calculateCREScore(row: any): number {
  // Calculate a commercial real estate relevance score based on available data
  let score = 0;
  
  // Get text fields to analyze
  const title = getColumnValue(row, ['Title', 'Opportunity Title', 'Name', 'Project Name']) || '';
  const description = getColumnValue(row, ['Description', 'Synopsis', 'Details', 'Summary']) || '';
  const propertyType = getColumnValue(row, ['Property Type', 'Space Type', 'Building Type', 'Facility Type']) || '';
  const combined = (title + ' ' + description + ' ' + propertyType).toLowerCase();
  
  // Base score for having basic information
  if (title) score += 20;
  if (description) score += 15;
  if (getColumnValue(row, ['State', 'Location State', 'Place of Performance State'])) score += 10;
  
  // High-value CRE keywords
  const highValueKeywords = ['office', 'warehouse', 'retail', 'building', 'space', 'lease', 'rent', 'property', 'facility', 'real estate'];
  const foundHighValue = highValueKeywords.filter(keyword => combined.includes(keyword));
  score += foundHighValue.length * 6;
  
  // Medium-value keywords
  const mediumValueKeywords = ['construction', 'renovation', 'maintenance', 'hvac', 'security', 'parking', 'accessibility'];
  const foundMedium = mediumValueKeywords.filter(keyword => combined.includes(keyword));
  score += foundMedium.length * 3;
  
  // Bonus for specific space measurements
  if (getColumnValue(row, ['Min Square Feet', 'Max Square Feet', 'Total Square Feet', 'Square Feet'])) score += 20;
  
  // Financial information bonus
  if (getColumnValue(row, ['Min Value', 'Max Value', 'Total Value', 'Contract Value', 'Budget'])) score += 10;
  
  // Location coordinates bonus
  if (parseCoordinates(row)) score += 5;
  
  // NAICS code bonus for real estate related codes
  const naics = getColumnValue(row, ['NAICS', 'NAICS Code', 'Industry Code']);
  if (naics) {
    const realEstateNAICS = ['531', '236', '238', '561']; // Real estate, construction, specialty trades, support services
    if (realEstateNAICS.some(code => naics.includes(code))) {
      score += 15;
    }
  }
  
  // Cap at 100
  return Math.min(score, 100);
}