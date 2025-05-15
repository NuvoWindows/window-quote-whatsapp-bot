# Quote API Documentation

The Window Quote WhatsApp Bot includes a comprehensive Quote API for generating detailed window quotes. This document outlines the available endpoints and their usage.

## API Endpoints

### Calculate Simple Quote

**Endpoint:** `POST /api/quotes/calculate`

**Description:** Generates a simple window quote from a text message.

**Request Body:**
```json
{
  "message": "I need a quote for a 36x48 standard window with double pane glass and grilles"
}
```

**Example Response:**
```json
{
  "dimensions": {
    "width": 36,
    "height": 48
  },
  "windowType": "standard",
  "paneCount": 2,
  "options": {
    "lowE": false,
    "grilles": true
  },
  "quote": {
    "squareFootage": 12,
    "priceRange": {
      "min": 526,
      "max": 644
    },
    "installationExtra": 180
  }
}
```

### Calculate Detailed Quote

**Endpoint:** `POST /api/quotes/detailed`

**Description:** Generates a detailed window quote with full pricing breakdown.

**Request Body:**
```json
{
  "width": 36,
  "height": 48,
  "type": "standard",
  "operationType": "Hung",
  "paneCount": 2,
  "options": {
    "lowE": true,
    "grilles": true,
    "glassType": "clear"
  },
  "quantity": 1,
  "sidingArea": 0
}
```

**Example Response:**
```json
{
  "window": {
    "dimensions": {
      "width": 36,
      "height": 48,
      "squareFootage": 12
    },
    "type": "standard",
    "operationType": "Hung",
    "paneCount": 2,
    "options": {
      "lowE": true,
      "grilles": true,
      "glassType": "clear"
    },
    "quantity": 1
  },
  "pricing": {
    "basePrice": 464,
    "optionsPrice": {
      "glassType": 0,
      "paneCount": 0,
      "lowE": 110,
      "grilles": 60
    },
    "windowSubtotal": 634,
    "subtotal": 634,
    "discount": 0,
    "installationCost": 180,
    "total": 814
  },
  "quoteLink": "/api/quotes/details?window=%7B%22width%22%3A36%2C%22height%22%3A48%2C%22type%22%3A%22standard%22%2C%22operationType%22%3A%22Hung%22%2C%22paneCount%22%3A2%2C%22options%22%3A%7B%22lowE%22%3Atrue%2C%22grilles%22%3Atrue%2C%22glassType%22%3A%22clear%22%7D%2C%22quantity%22%3A1%2C%22sidingArea%22%3A0%7D"
}
```

### Generate Quote from Conversation

**Endpoint:** `POST /api/quotes/from-conversation`

**Description:** Extracts window specifications from conversation messages and generates a quote.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I need a quote for a kitchen window"
    },
    {
      "role": "assistant",
      "content": "Great! Could you please provide the dimensions of that kitchen window?"
    },
    {
      "role": "user",
      "content": "It's 36 inches wide and 48 inches tall"
    },
    {
      "role": "assistant",
      "content": "Thanks for those dimensions. What type of window are you interested in - standard, bay, or shaped?"
    },
    {
      "role": "user",
      "content": "Standard window with double pane glass and Low-E"
    }
  ]
}
```

**Example Response:**
```json
{
  "specifications": {
    "location": "Kitchen",
    "width": 36,
    "height": 48,
    "window_type": "Standard",
    "glass_type": "Double pane",
    "features": ["Low-E glass"],
    "is_complete": true
  },
  "quote": {
    // Detailed quote object as in the /detailed endpoint
  }
}
```

### Get Quote Details

**Endpoint:** `GET /api/quotes/details`

**Description:** Returns a detailed HTML representation of a quote.

**Query Parameters:**
- `window`: URL-encoded JSON object with window specifications

**Response:** Redirects to an HTML page with a detailed quote breakdown.

### Get Sample Quote

**Endpoint:** `GET /api/quotes/sample`

**Description:** Returns a sample quote for demonstration purposes.

**Example Response:**
```json
{
  // Detailed quote object for a 36x48 standard window
}
```

## Pricing Variables

The quote service incorporates various pricing factors:

### Base Window Pricing
- Based on window size (square footage) and operation type
- Specific pricing for different operation types (Hung, Slider, Fixed, Casement, Awning)
- Square footage pricing tiers from 6-13 sq ft with overage pricing beyond that

### Window Type Adjustments
- **Standard Windows**: Base pricing applies
- **Shaped Windows**: Base price for rectangular section plus additional pricing for arched top based on diameter tiers
- **Bay Windows**: Base price plus additional costs for header/footer (50% of base price) and optional exterior siding ($15 per sq ft)

### Glass Options
- **Pane Count**: Double pane (standard) or Triple pane (+$11 per sq ft)
- **Glass Type**: Clear (standard), Frosted (+$4 per sq ft), or Tinted (+$5 per sq ft)
- **Low-E with Argon**: +$110 per window
- **Grilles**: +$5 per sq ft

### Other Factors
- **Installation**: $15 per square foot (minimum $150)
- **Multiple Window Discount**: 2-20% based on quantity (2%: 2 windows, 3%: 3 windows, 5%: 5+ windows, 8%: 10+ windows, 12%: 20+ windows)

## Usage Examples

### Curl Examples

Calculate a simple quote:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"message":"36x48 standard window with grilles"}' http://localhost:3000/api/quotes/calculate
```

Generate a detailed quote:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"width":36,"height":48,"type":"standard","operationType":"Hung","paneCount":2,"options":{"lowE":true,"grilles":true}}' http://localhost:3000/api/quotes/detailed
```

Get a sample quote:
```bash
curl http://localhost:3000/api/quotes/sample
```

## Future Enhancements

In future releases, the Quote API will be enhanced with:
- Database-backed quote storage for persistence
- Multi-window quotes in a single project
- Quote status tracking (draft, sent, accepted, declined)
- Email delivery of quote PDFs
- Quote comparison and revision history