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

    // Upload to Notion
    const notionResults = await uploadOpportunitiesToNotion(opportunities);

    return NextResponse.json({
      success: true,
      uploaded: notionResults.length,
      notionPages: notionResults,
      message: `Successfully uploaded ${notionResults.length} opportunities to Notion`
    });

  } catch (error) {
    console.error('Notion upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to Notion' },
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

    const opportunity = mapRowToOpportunity(row, i);
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }

  return opportunities;
}

function mapRowToOpportunity(row: any, index: number) {
  return {
    id: `excel-${Date.now()}-${index}`,
    title: getColumnValue(row, ['Title', 'Opportunity Title', 'Name', 'Project Name']) || 'Untitled Opportunity',
    description: getColumnValue(row, ['Description', 'Synopsis', 'Details', 'Summary']) || '',
    agency: getColumnValue(row, ['Agency', 'Issuing Agency', 'Organization', 'Department']) || 'Unknown Agency',
    solicitationNumber: getColumnValue(row, ['Solicitation Number', 'ID', 'Opportunity ID', 'RFP ID']) || `EXCEL-${index}`,
    type: getColumnValue(row, ['Type', 'RFP Type', 'Opportunity Type']) || 'RFP',
    status: getColumnValue(row, ['Status', 'State', 'Opportunity Status']) || 'Open',
    
    // Location information
    state: getColumnValue(row, ['State', 'Location State', 'Place of Performance State']),
    city: getColumnValue(row, ['City', 'Location City', 'Place of Performance City']),
    zipCode: getColumnValue(row, ['ZIP', 'Zip Code', 'Postal Code']),
    
    // Financial information
    minValue: parseNumber(getColumnValue(row, ['Min Value', 'Estimated Value Min', 'Budget Min'])),
    maxValue: parseNumber(getColumnValue(row, ['Max Value', 'Estimated Value Max', 'Budget Max', 'Total Value'])),
    
    // Dates
    postedDate: parseDate(getColumnValue(row, ['Posted Date', 'Date Posted', 'Publication Date'])),
    dueDate: parseDate(getColumnValue(row, ['Due Date', 'Response Due Date', 'Deadline'])),
    
    // Space requirements
    minSquareFeet: parseNumber(getColumnValue(row, ['Min Square Feet', 'Min SF', 'Minimum Space'])),
    maxSquareFeet: parseNumber(getColumnValue(row, ['Max Square Feet', 'Max SF', 'Maximum Space', 'Total Square Feet'])),
    propertyType: getColumnValue(row, ['Property Type', 'Space Type', 'Building Type', 'Facility Type']),
    
    // Coordinates
    latitude: parseNumber(getColumnValue(row, ['Latitude', 'Lat', 'Y'])),
    longitude: parseNumber(getColumnValue(row, ['Longitude', 'Lng', 'Lon', 'X'])),
    
    // Additional fields
    naicsCode: getColumnValue(row, ['NAICS', 'NAICS Code', 'Industry Code']),
    setAside: getColumnValue(row, ['Set Aside', 'Set-Aside', 'Contracting Vehicle']),
    
    // Meta
    source: 'excel_upload',
    uploadedAt: new Date().toISOString()
  };
}

function getColumnValue(row: any, possibleNames: string[]): string | undefined {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return String(row[name]).trim();
    }
  }
  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
}

async function uploadOpportunitiesToNotion(opportunities: any[]) {
  const notionApiToken = process.env.NOTION_API_TOKEN;
  const notionDatabaseId = process.env.NOTION_OPPORTUNITIES_DATABASE_ID;

  if (!notionApiToken || !notionDatabaseId) {
    throw new Error('Notion API credentials not configured. Please set NOTION_API_TOKEN and NOTION_OPPORTUNITIES_DATABASE_ID');
  }

  const results = [];

  for (const opportunity of opportunities) {
    try {
      const notionPage = await createNotionOpportunityPage(opportunity, notionApiToken, notionDatabaseId);
      results.push(notionPage);
    } catch (error) {
      console.error(`Failed to create Notion page for opportunity ${opportunity.id}:`, error);
      // Continue with other opportunities even if one fails
    }
  }

  return results;
}

async function createNotionOpportunityPage(opportunity: any, apiToken: string, databaseId: string) {
  const url = 'https://api.notion.com/v1/pages';
  
  const pageData = {
    parent: { database_id: databaseId },
    properties: {
      'Title': {
        title: [{ text: { content: opportunity.title } }]
      },
      'Solicitation Number': {
        rich_text: [{ text: { content: opportunity.solicitationNumber || '' } }]
      },
      'Description': {
        rich_text: [{ text: { content: opportunity.description || '' } }]
      },
      'Agency': {
        select: { name: opportunity.agency || 'Unknown' }
      },
      'Type': {
        select: { name: opportunity.type || 'RFP' }
      },
      'Status': {
        select: { name: opportunity.status || 'Open' }
      },
      'State': {
        select: { name: opportunity.state || 'Unknown' }
      },
      'City': {
        rich_text: [{ text: { content: opportunity.city || '' } }]
      },
      'ZIP Code': {
        rich_text: [{ text: { content: opportunity.zipCode || '' } }]
      },
      'Min Value': {
        number: opportunity.minValue || null
      },
      'Max Value': {
        number: opportunity.maxValue || null
      },
      'Posted Date': {
        date: opportunity.postedDate ? { start: opportunity.postedDate } : null
      },
      'Due Date': {
        date: opportunity.dueDate ? { start: opportunity.dueDate } : null
      },
      'Min Square Feet': {
        number: opportunity.minSquareFeet || null
      },
      'Max Square Feet': {
        number: opportunity.maxSquareFeet || null
      },
      'Property Type': {
        select: { name: opportunity.propertyType || 'Office' }
      },
      'Latitude': {
        number: opportunity.latitude || null
      },
      'Longitude': {
        number: opportunity.longitude || null
      },
      'NAICS Code': {
        rich_text: [{ text: { content: opportunity.naicsCode || '' } }]
      },
      'Set Aside': {
        select: { name: opportunity.setAside || 'None' }
      },
      'Source': {
        select: { name: opportunity.source || 'excel_upload' }
      },
      'Uploaded At': {
        date: { start: opportunity.uploadedAt }
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(pageData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}