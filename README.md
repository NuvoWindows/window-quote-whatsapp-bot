# Window Quote WhatsApp Bot

A WhatsApp bot that provides automated window installation price quotes through conversational AI.

## Features

- WhatsApp integration through Meta's Graph API
- Conversational AI powered by Claude 3 Haiku
- Persistent conversation context with 30-day retention
- Intelligent extraction of window specifications
- Automated window installation price quotes based on:
  - Window dimensions (width × height)
  - Window type (standard, bay, or shaped)
  - Glass type (double or triple pane)
  - Special features (grilles, low-E glass with argon, etc.)
- Comprehensive logging and monitoring
- Admin interface for conversation management

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/window-quote-whatsapp-bot.git
cd window-quote-whatsapp-bot

# Install dependencies
npm install
```

## Configuration

1. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in the `.env` file:
   ```
   # Server config
   PORT=3000

   # WhatsApp API config
   WHATSAPP_API_VERSION=v19.0
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
   WHATSAPP_VERIFY_TOKEN=your_verify_token

   # Claude API config
   CLAUDE_API_KEY=your_claude_api_key
   CLAUDE_MAX_RETRIES=3
   CLAUDE_RETRY_BASE_DELAY_MS=300
   CLAUDE_RETRY_MAX_DELAY_MS=3000

   # Logging config
   LOG_LEVEL=info
   LOG_TO_FILE=true
   LOG_DIR=logs

   # Database config
   DB_PATH=./data/bot.db
   CONVERSATION_EXPIRY_DAYS=30

   # Admin interface config
   ADMIN_TOKEN=your_secure_admin_token
   ```

3. Alternatively, you can use the credentials JSON template:
   ```bash
   cp credentials.example.json credentials.json
   ```
   Then edit `credentials.json` with your actual credentials.

## Usage

```bash
# Start the server
npm start

# For development with auto-restart
npm run dev
```

## API Endpoints

### WhatsApp API
- `GET /api/webhook`: Webhook verification for WhatsApp API
- `POST /api/webhook`: Webhook to receive WhatsApp messages
- `POST /api/generate-quote`: Generate a window installation quote

### Admin API
- `GET /admin/conversations`: List all active conversations
- `GET /admin/conversations/:userId`: Get details for a specific conversation
- `DELETE /admin/conversations/:userId`: Delete a specific conversation
- `POST /admin/expire-conversations`: Force expire old conversations

See [ADMIN_API.md](docs/ADMIN_API.md) for detailed documentation on the admin API.

## Project Structure

```
src/
├── config/         # Configuration settings
├── controllers/    # Route controllers
├── routes/         # API routes (WhatsApp and Admin)
├── services/       # Business logic
│   ├── claudeService.js          # Claude AI integration
│   ├── conversationManager.js    # Conversation persistence
│   ├── quoteService.js           # Window quote calculation
│   └── whatsappService.js        # WhatsApp messaging
└── utils/          # Utility functions
    ├── database.js               # SQLite database management
    ├── logger.js                 # Structured logging
    ├── messageParser.js          # WhatsApp message parsing
    └── windowSpecParser.js       # Window specification extraction

data/               # Database storage (Git-ignored)
logs/               # Log files (Git-ignored)
docs/               # Documentation
```

## Deployment

The application follows a multi-environment deployment strategy:

### Testing Environment (Railway)
- Quick setup with free tier for testing
- Automatic deployments from GitHub
- Environment variables configured in Railway dashboard

### Production Environment (Render)
- Reliable hosting for production workloads
- Scalable Web Service with competitive pricing
- Zero-downtime deployments and advanced monitoring

## Documentation

- For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)
- For implementation roadmap, see [ROADMAP.md](ROADMAP.md)
- For conversation context management, see [CONVERSATION_CONTEXT.md](docs/CONVERSATION_CONTEXT.md)
- For admin API documentation, see [ADMIN_API.md](docs/ADMIN_API.md)
- For auto-push functionality, see [AUTO-PUSH.md](AUTO-PUSH.md)

## License

[MIT](LICENSE)