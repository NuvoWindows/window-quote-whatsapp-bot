# Window Quote WhatsApp Bot

A WhatsApp bot that provides automated window installation price quotes through conversational AI.

## Features

- WhatsApp integration through Meta's Graph API
- Conversational AI powered by Claude 3 Haiku
- Automated window installation price quotes based on:
  - Window dimensions (width × height)
  - Window type (standard, bay, or shaped)
  - Glass type (single, double, or triple pane)
  - Special features (grilles, low-E glass with argon, etc.)

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
   PORT=3000
   WHATSAPP_API_VERSION=v19.0
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
   WHATSAPP_VERIFY_TOKEN=your_verify_token
   CLAUDE_API_KEY=your_claude_api_key
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

- `GET /api/webhook`: Webhook verification for WhatsApp API
- `POST /api/webhook`: Webhook to receive WhatsApp messages
- `POST /api/generate-quote`: Generate a window installation quote

## Project Structure

```
src/
├── config/         # Configuration settings
├── controllers/    # Route controllers
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Utility functions
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
- For auto-push functionality, see [AUTO-PUSH.md](AUTO-PUSH.md)

## License

[MIT](LICENSE)