# Admin API Documentation

The Window Quote WhatsApp Bot includes an admin API that allows management and monitoring of conversations. This document outlines the available endpoints and their usage.

## Authentication

All admin API endpoints require authentication using a bearer token. Set the `ADMIN_TOKEN` environment variable to a secure random string, and include it in requests as follows:

```
Authorization: Bearer your-admin-token-here
```

If no `ADMIN_TOKEN` is set, authentication is skipped (for development only).

## API Endpoints

### List All Active Conversations

**Endpoint:** `GET /admin/conversations`

**Description:** Returns a list of all active conversations that haven't expired.

**Example Response:**
```json
[
  {
    "id": 1,
    "user_id": "1234567890",
    "user_name": "John Doe",
    "last_active": "2023-05-12T14:30:00.000Z",
    "created_at": "2023-05-10T09:15:00.000Z",
    "expire_at": "2023-06-09T09:15:00.000Z",
    "metadata": "{}",
    "message_count": 8
  },
  {
    "id": 2,
    "user_id": "9876543210",
    "user_name": "Jane Smith",
    "last_active": "2023-05-12T10:45:00.000Z",
    "created_at": "2023-05-11T15:20:00.000Z",
    "expire_at": "2023-06-10T15:20:00.000Z",
    "metadata": "{}",
    "message_count": 12
  }
]
```

### Get Conversation Details

**Endpoint:** `GET /admin/conversations/:userId`

**Description:** Returns detailed information about a specific conversation, including all messages and window specifications.

**URL Parameters:**
- `userId`: The WhatsApp phone number ID of the user

**Example Response:**
```json
{
  "userId": "1234567890",
  "messages": [
    {
      "role": "assistant",
      "content": "Hi John! I'm your window quote assistant. How can I help you today?"
    },
    {
      "role": "user",
      "content": "I need a quote for my kitchen window"
    },
    {
      "role": "assistant",
      "content": "Great! Could you please provide the dimensions of that kitchen window? I'll need the width and height in inches."
    }
  ],
  "specifications": [
    {
      "id": 1,
      "conversation_id": 1,
      "location": "Kitchen",
      "width": 36,
      "height": 48,
      "window_type": "Standard",
      "glass_type": "Double pane",
      "features": ["Low-E glass", "Grilles"],
      "timestamp": "2023-05-12T12:30:00.000Z"
    }
  ]
}
```

### Delete a Conversation

**Endpoint:** `DELETE /admin/conversations/:userId`

**Description:** Permanently deletes a conversation and all associated messages and specifications.

**URL Parameters:**
- `userId`: The WhatsApp phone number ID of the user

**Example Response:**
```json
{
  "success": true,
  "message": "Conversation deleted"
}
```

### Force Expire Old Conversations

**Endpoint:** `POST /admin/expire-conversations`

**Description:** Manually triggers the expiration process for conversations that are older than the configured expiry period.

**Example Response:**
```json
{
  "success": true,
  "count": 3
}
```

## Usage Examples

### Curl Examples

List all conversations:
```bash
curl -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/admin/conversations
```

Get conversation details:
```bash
curl -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/admin/conversations/1234567890
```

Delete a conversation:
```bash
curl -X DELETE -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/admin/conversations/1234567890
```

Expire old conversations:
```bash
curl -X POST -H "Authorization: Bearer your-admin-token-here" http://localhost:3000/admin/expire-conversations
```

## Security Considerations

- Use HTTPS in production to protect the admin token and sensitive conversation data
- Set a strong, random `ADMIN_TOKEN` (at least 32 characters)
- Consider implementing IP restrictions for admin access
- Regularly rotate the admin token
- Monitor access logs for unusual activity