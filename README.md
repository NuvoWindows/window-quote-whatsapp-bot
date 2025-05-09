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

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
CLAUDE_API_KEY=your_claude_api_key
```

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
- `POST /api/quote`: Generate a window installation quote

## Project Structure

```
src/
├── config/         # Configuration settings
├── controllers/    # Route controllers
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Utility functions
```

## License

[MIT](LICENSE)