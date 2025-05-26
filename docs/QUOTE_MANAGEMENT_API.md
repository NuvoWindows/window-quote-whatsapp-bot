# Quote Management API Documentation

This document describes the API endpoints for the Window Quote system's multi-window quote management functionality.

## Overview

The Quote Management API provides endpoints for creating, retrieving, updating, and deleting quotes with multiple windows. It supports:

- Creating and managing quotes with multiple windows
- Tracking quote status (draft, complete, revision)
- Generating HTML quote files
- Creating quotes from previous WhatsApp conversations

## API Endpoints

### Quotes

#### Create a new quote

```
POST /api/quote-management/quotes
```

Creates a new quote with the provided information.

**Request Body:**

```json
{
  "customer_id": "string", 
  "customer_name": "string",
  "customer_email": "string",
  "description": "string",
  "status": "draft", 
  "discount_rate": 0.05,
  "tax_rate": 0.13,
  "metadata": {}
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quote created successfully",
  "quote": {
    "id": 1,
    "customer_id": "string",
    "customer_name": "string",
    "status": "draft",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "expires_at": "timestamp"
  }
}
```

#### Get a quote by ID

```
GET /api/quote-management/quotes/:id
```

Retrieves a quote by its ID, including all associated windows.

**Response:**

```json
{
  "success": true,
  "quote": {
    "id": 1,
    "customer_id": "string",
    "customer_name": "string",
    "status": "draft",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "expires_at": "timestamp",
    "windows": [
      {
        "window_id": 1,
        "location": "Living Room",
        "width": 36,
        "height": 48,
        "type": "standard",
        "operation_type": "Hung",
        "base_price": 350,
        "options_price": 110,
        "window_subtotal": 460,
        "installation_price": 150
      }
    ]
  }
}
```

#### Update a quote

```
PUT /api/quote-management/quotes/:id
```

Updates an existing quote.

**Request Body:**

```json
{
  "customer_name": "string",
  "description": "string",
  "discount_rate": 0.1,
  "status": "complete"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quote updated successfully",
  "quote": {
    "id": 1,
    "customer_name": "string",
    "status": "complete",
    "discount_rate": 0.1,
    "updated_at": "timestamp"
  }
}
```

#### Delete a quote

```
DELETE /api/quote-management/quotes/:id
```

Deletes a quote and all associated windows.

**Response:**

```json
{
  "success": true,
  "message": "Quote deleted successfully"
}
```

#### Get recent quotes

```
GET /api/quote-management/quotes?limit=10
```

Retrieves a list of recent quotes, limited by the optional `limit` parameter.

**Response:**

```json
{
  "success": true,
  "quotes": [
    {
      "id": 1,
      "customer_name": "string",
      "status": "draft",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

#### Get quotes by customer ID

```
GET /api/quote-management/quotes/customer/:customerId
```

Retrieves quotes for a specific customer.

**Response:**

```json
{
  "success": true,
  "quotes": [
    {
      "id": 1,
      "customer_id": "string",
      "customer_name": "string",
      "status": "draft",
      "created_at": "timestamp"
    }
  ]
}
```

#### Get quotes by conversation ID

```
GET /api/quote-management/quotes/conversation/:conversationId
```

Retrieves quotes associated with a WhatsApp conversation.

**Response:**

```json
{
  "success": true,
  "quotes": [
    {
      "id": 1,
      "conversation_id": 123,
      "customer_name": "string",
      "status": "draft",
      "created_at": "timestamp"
    }
  ]
}
```

#### Create a quote from a conversation

```
POST /api/quote-management/quotes/from-conversation/:conversationId
```

Creates a new quote based on window specifications gathered in a WhatsApp conversation.

**Request Body:**

```json
{
  "customerId": "string",
  "customerName": "string"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quote created from conversation successfully",
  "quote": {
    "id": 1,
    "conversation_id": 123,
    "customer_id": "string",
    "customer_name": "string",
    "status": "draft",
    "windows": [
      {
        "window_id": 1,
        "width": 36,
        "height": 48,
        "type": "standard"
      }
    ]
  }
}
```

#### Complete a quote

```
POST /api/quote-management/quotes/:id/complete
```

Marks a quote as complete and generates a final quote file.

**Response:**

```json
{
  "success": true,
  "message": "Quote completed successfully",
  "quote": {
    "id": 1,
    "status": "complete",
    "file_url": "/quotes/quote_1_1620000000000.html"
  }
}
```

#### Generate and get the quote file

```
GET /api/quote-management/quotes/:id/file
```

Generates an HTML file for the quote and redirects to it.

### Windows

#### Add a window to a quote

```
POST /api/quote-management/quotes/:id/windows
```

Adds a new window to an existing quote.

**Request Body:**

```json
{
  "width": 36,
  "height": 48,
  "type": "standard",
  "operation_type": "Hung",
  "pane_count": 2,
  "glass_type": "clear",
  "has_low_e": true,
  "has_grilles": false,
  "has_interior_color": false,
  "has_exterior_color": false,
  "quantity": 1,
  "location": "Living Room"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Window added to quote successfully",
  "window": {
    "window_id": 1,
    "quote_id": 1,
    "width": 36,
    "height": 48,
    "type": "standard",
    "operation_type": "Hung",
    "base_price": 350,
    "window_subtotal": 460,
    "installation_price": 150
  }
}
```

#### Update a window

```
PUT /api/quote-management/windows/:windowId
```

Updates an existing window.

**Request Body:**

```json
{
  "width": 48,
  "height": 60,
  "type": "bay",
  "bay_siding_area": 15
}
```

**Response:**

```json
{
  "success": true,
  "message": "Window updated successfully",
  "window": {
    "window_id": 1,
    "quote_id": 1,
    "width": 48,
    "height": 60,
    "type": "bay",
    "bay_siding_area": 15
  }
}
```

#### Remove a window from a quote

```
DELETE /api/quote-management/windows/:windowId
```

Removes a window from a quote.

**Response:**

```json
{
  "success": true,
  "message": "Window removed from quote successfully"
}
```

## Database Schema

The Quote Management system uses the following tables:

### quotes

Stores overall quote information:

- `id`: Primary key
- `conversation_id`: Reference to WhatsApp conversation (optional)
- `customer_id`: Customer identifier (typically phone number)
- `customer_name`: Customer's name
- `customer_email`: Customer's email
- `description`: Project description
- `status`: Quote status ('draft', 'complete', 'revision')
- `quote_version`: Version number
- `discount_rate`: Additional discount rate
- `tax_rate`: Applied tax rate
- `total_amount`: Total quote amount
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `expires_at`: Expiration date
- `metadata`: Additional JSON data

### quote_windows

Stores individual windows within a quote:

- `window_id`: Primary key
- `quote_id`: Reference to parent quote
- `location`: Room/location description
- `width`, `height`: Window dimensions
- `square_footage`: Calculated area
- `type`: Window type ('standard', 'bay', 'shaped')
- `operation_type`: Operation type ('Hung', 'Slider', etc.)
- `pane_count`: Number of panes
- `glass_type`: Type of glass
- `has_low_e`, `has_grilles`: Feature flags
- `has_interior_color`, `has_exterior_color`: Color options
- `quantity`: Number of identical windows
- `base_price`: Base window price
- `options_price`: Cost of options
- `bay_header_footer_cost`, `bay_siding_cost`: Bay window specifics
- `shaped_window_cost`: Shaped window arched top cost
- `window_subtotal`: Window subtotal
- `installation_price`: Installation cost
- `display_order`: Display sequence
- `note`: Special instructions
- `created_at`, `updated_at`: Timestamps

### quote_status_history

Tracks status changes:

- `id`: Primary key
- `quote_id`: Reference to quote
- `previous_status`: Previous status
- `new_status`: New status
- `changed_at`: Timestamp of change
- `changed_by`: User who made the change
- `notes`: Reason for change

### quote_files

Tracks generated quote files:

- `id`: Primary key
- `quote_id`: Reference to quote
- `file_type`: File format ('html', 'pdf')
- `file_path`: Storage path
- `file_url`: Access URL
- `is_current`: Whether this is the current version
- `created_at`: Creation timestamp

## Status Workflow

Quotes follow this status workflow:

1. **draft**: Initial state when a quote is created
2. **complete**: Quote is finalized and ready for the customer
3. **revision**: A previously completed quote that has been modified

When a window is added, updated, or removed from a completed quote, the quote's status automatically changes to 'revision'.

## Integration with Conversation System

The Quote Management system integrates with the existing WhatsApp conversation system:

1. Window specifications extracted during WhatsApp conversations are stored in the `window_specifications` table
2. These specifications can be used to create quotes using the `/quotes/from-conversation/:conversationId` endpoint
3. Quotes maintain a reference to their originating conversation, allowing for easy access to the conversation history