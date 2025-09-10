# Frontend Data Specification & Table Definitions

## 🎯 Current Database Status
- **39 records** from 5 freight quotes
- **Fresh data** (no duplicates)
- **Complete metadata** in all fields
- **Collection**: `FreightChunks_Hierarchical`

## 🔌 Connection Details

### Weaviate Configuration
```env
WEAVIATE_URL=https://v3uos4zarh9svyfgqap3w.c0.asia-southeast1.gcp.weaviate.cloud
WEAVIATE_API_KEY=N1pPZlA0c3BENEdrdUc3R19SZ2I4K1hKeFlGYjNzbUVHbmovbE8zNU0rb0V2MFBCbTR2SStkMTRsaGpVPV92MjAw
WEAVIATE_COLLECTION_NAME=FreightChunks_Hierarchical
```

### GraphQL Endpoint
```
https://v3uos4zarh9svyfgqap3w.c0.asia-southeast1.gcp.weaviate.cloud/v1/graphql
```

## 📊 Table Structure Definition

### Main Freight Quotes Table
Display unique quotes by grouping chunks by `quote_reference`:

| Column | Field Name | Data Type | Sample Value | Description |
|--------|------------|-----------|--------------|-------------|
| Quote Reference | `quote_reference` | string | "PGL-250211" | Unique quote identifier |
| Customer | `customer_name` | string | "Aier Environmental Protection Engineering Co.,Ltd" | Customer company name |
| Origin | `origin_port` | string | "Changshu" | Origin port code/name |
| Origin City | `origin_city` | string | "Changshu" | Origin city |
| Origin Country | `origin_country` | string | "China" | Origin country |
| Destination | `destination_port` | string | "Fremantle" | Destination port code/name |
| Destination City | `destination_city` | string | "Fremantle" | Destination city |
| Destination Country | `destination_country` | string | "Australia" | Destination country |
| Date Issued | `date_issued` | string | "2025-04-22T00:00:00Z" | Quote issue date |
| Currency | `currency` | string | "USD" | Quote currency |
| Total Value | `total_value` | number | 327142.47 | Total quote value |
| Container Count | `container_count` | integer | 26 | Number of containers |
| Margin % | `margin_percentage` | number | 86.8 | Profit margin percentage |
| Hazardous | `is_hazardous` | boolean | false | Contains hazardous goods |
| Refrigerated | `is_refrigerated` | boolean | false | Requires refrigeration |
| Oversized | `is_oversized` | boolean | true | Contains oversized cargo |

### Line Items Detail Table
When expanding a quote, show individual chunks:

| Column | Field Name | Data Type | Sample Value |
|--------|------------|-----------|--------------|
| Chunk Type | `chunk_type` | string | "HEADER", "LINE_ITEMS", "COMMERCIAL", "NOTES" |
| Chunk ID | `chunk_id` | string | "2269816e-9530-4b95-85ea-86c533275ed8" |
| PDF Name | `pdf_name` | string | "PGL-250211 - Zhangjiagang to Kwinana.pdf" |

## 🎨 Frontend Implementation Guide

### Step 1: GraphQL Query for Main Table
```graphql
{
  Get {
    FreightChunks_Hierarchical(limit: 100) {
      quote_reference
      customer_name
      origin_port
      destination_port
      origin_city
      origin_country
      destination_city
      destination_country
      date_issued
      currency
      total_value
      container_count
      margin_percentage
      is_hazardous
      is_refrigerated
      is_oversized
      chunk_type
      pdf_name
    }
  }
}
```

### Step 2: Data Grouping Logic
```javascript
// Group chunks by quote_reference to show unique quotes
const groupedQuotes = data.reduce((acc, chunk) => {
  if (!acc[chunk.quote_reference]) {
    acc[chunk.quote_reference] = {
      ...chunk,
      chunks: []
    };
  }
  acc[chunk.quote_reference].chunks.push(chunk);
  return acc;
}, {});

// Convert to array for table display
const uniqueQuotes = Object.values(groupedQuotes);
```

### Step 3: Authentication Headers
```javascript
const headers = {
  'Authorization': 'Bearer N1pPZlA0c3BENEdrdUc3R19SZ2I4K1hKeFlGYjNzbUVHbmovbE8zNU0rb0V2MFBCbTR2SStkMTRsaGpVPV92MjAw',
  'Content-Type': 'application/json'
};
```

## 📋 Available Test Data

### Quote References (5 unique)
- **FCL - IMP** - Primero Group, Shanghai → Fremantle
- **PGL-240654** - Geofabrics, Brisbane → Fremantle  
- **PGL-250211** - Aier Environmental, Changshu → Fremantle
- **PGL-250478** - Caddy Industrial, CNSHK → Fremantle
- **PGL-250487A** - Weir, Changshu Port → Dampier

### Chunk Types (4 per quote)
- `HEADER` - Quote header information
- `LINE_ITEMS` - Detailed line items
- `COMMERCIAL` - Commercial terms
- `NOTES` - Special notes and conditions

## 🔍 Troubleshooting

### If No Data Appears:

1. **Test Direct API Access:**
```bash
curl -X POST \
  https://v3uos4zarh9svyfgqap3w.c0.asia-southeast1.gcp.weaviate.cloud/v1/graphql \
  -H 'Authorization: Bearer N1pPZlA0c3BENEdrdUc3R19SZ2I4K1hKeFlGYjNzbUVHbmovbE8zNU0rb0V2MFBCbTR2SStkMTRsaGpVPV92MjAw' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ Get { FreightChunks_Hierarchical(limit: 5) { quote_reference customer_name } } }"}'
```

2. **Check Collection Name:** Must be exactly `FreightChunks_Hierarchical`

3. **Verify Field Names:** Use snake_case (e.g., `quote_reference` NOT `quoteReference`)

4. **Check CORS:** May need to enable CORS for your frontend domain

## 💡 Display Recommendations

### Main Table View
- Show 1 row per unique quote (5 rows total)
- Use expandable rows to show chunk details
- Format currency values: `$327,142.47`
- Format dates: `Apr 22, 2025`
- Show boolean flags as icons (⚠️ for hazardous, 🧊 for refrigerated, 📦 for oversized)

### Filters
- Customer dropdown: 5 unique customers
- Origin/Destination dropdowns: Various cities
- Date range picker
- Value range slider

### Sorting
- Default: Date issued (newest first)
- Allow sorting by value, margin %, customer name

## 🚀 Expected Result
You should see a table with 5 freight quotes, each containing complete metadata including customer names, cities, countries, values, and special conditions. Each quote can be expanded to show its 7-9 individual chunks.

If you're still not seeing data, the issue is likely in your GraphQL query syntax or authentication headers.