# Window Quote WhatsApp Bot

A WhatsApp bot that provides automated window installation price quotes through conversational AI.

## Features

- WhatsApp integration through Meta's Graph API
- Conversational AI powered by Claude 3 Haiku
- Persistent conversation context with 30-day retention
- Intelligent extraction of window specifications
- Advanced window installation price quotes based on:
  - Window dimensions (width × height)
  - Window operation type (Hung, Slider, Fixed, Casement, Awning)
  - Window type (standard, bay, or shaped)
  - Glass type (double or triple pane, clear, frosted, tinted)
  - Special features (grilles, low-E glass with argon, etc.)
- Database-backed multi-window quote system with:
  - Support for multiple windows in a single quote
  - Quote status tracking (draft, complete, revision)
  - Persistent storage with SQLite
  - Detailed HTML quote generation
  - Quote history and versioning
- Comprehensive logging and monitoring with:
  - Error pattern detection and alerting
  - Performance metrics tracking
  - Conversation health monitoring
- Admin interface for conversation management
- Robust error handling with:
  - Automatic retry mechanisms with exponential backoff
  - Intelligent clarification for ambiguous specifications
  - Context-aware error recovery strategies
  - Professional measurement service integration
  - Conversation resumption capabilities
  - Measurement deferral support

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

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

## API Endpoints

### WhatsApp API
- `GET /api/webhook`: Webhook verification for WhatsApp API
- `POST /api/webhook`: Webhook to receive WhatsApp messages

### Quote API
- `POST /api/quotes/calculate`: Generate a simple quote from text message
- `POST /api/quotes/detailed`: Generate a detailed quote with all options
- `POST /api/quotes/from-conversation`: Generate a quote based on conversation messages
- `GET /api/quotes/details`: Get a detailed quote as an HTML document
- `GET /api/quotes/sample`: Get a sample quote for demonstration

### Quote Management API
- `POST /api/quote-management/quotes`: Create a new quote
- `GET /api/quote-management/quotes/:id`: Get a quote by ID
- `PUT /api/quote-management/quotes/:id`: Update a quote
- `DELETE /api/quote-management/quotes/:id`: Delete a quote
- `GET /api/quote-management/quotes`: Get recent quotes
- `POST /api/quote-management/quotes/:id/windows`: Add a window to a quote
- `PUT /api/quote-management/windows/:windowId`: Update a window
- `DELETE /api/quote-management/windows/:windowId`: Remove a window
- `POST /api/quote-management/quotes/:id/complete`: Complete a quote
- `GET /api/quote-management/quotes/:id/file`: Generate and get the quote file
- `GET /api/quote-management/quotes/customer/:customerId`: Get quotes by customer
- `POST /api/quote-management/quotes/from-conversation/:conversationId`: Create quote from conversation

### Admin API
- `GET /admin/conversations`: List all active conversations
- `GET /admin/conversations/:userId`: Get details for a specific conversation
- `DELETE /admin/conversations/:userId`: Delete a specific conversation
- `POST /admin/expire-conversations`: Force expire old conversations

See [ADMIN_API.md](docs/ADMIN_API.md) for detailed documentation on the admin API.
See [QUOTE_API.md](docs/QUOTE_API.md) for detailed documentation on the quote API.
See [QUOTE_MANAGEMENT_API.md](docs/QUOTE_MANAGEMENT_API.md) for detailed documentation on the quote management API.

## Project Structure

```
src/
├── config/         # Configuration settings
├── controllers/    # Route controllers
│   ├── quoteController.js           # Quote generation controller
│   ├── quoteManagementController.js # Multi-window quote management controller
│   └── whatsappController.js        # WhatsApp webhook controller
├── db/             # Database schemas
│   └── quote_schema.js              # Multi-window quote database schema
├── models/         # Database models
│   └── quoteModel.js                # Quote database operations
├── routes/         # API routes
│   ├── adminRoutes.js               # Admin API routes
│   ├── quoteManagementRoutes.js     # Multi-window quote management routes
│   ├── quoteRoutes.js               # Quote generation routes
│   └── whatsappRoutes.js            # WhatsApp webhook routes
├── services/       # Business logic
│   ├── clarificationService.js      # Ambiguity clarification
│   ├── claudeService.js             # Claude AI integration
│   ├── conversationFlowService.js   # Conversation flow management
│   ├── conversationManager.js       # Conversation persistence
│   ├── errorContextService.js       # Error context preservation
│   ├── errorMonitoringService.js    # Error pattern monitoring & alerting
│   ├── errorRecoveryService.js      # Error recovery strategies
│   ├── measurementDeferralService.js # Measurement deferral handling
│   ├── multiWindowQuoteService.js   # Multi-window quote management
│   ├── professionalMeasurementService.js # Professional measurement recommendations
│   ├── quoteDetailService.js        # Quote HTML generation
│   ├── quoteService.js              # Quote calculation logic
│   └── whatsappService.js           # WhatsApp API integration
└── utils/          # Utility functions
    ├── ambiguityDetector.js         # Ambiguous term detection
    ├── contextSummarizer.js         # Conversation context summarization
    ├── database.js                  # SQLite database management
    ├── logger.js                    # Enhanced structured logging with error tracking
    ├── messageParser.js             # WhatsApp message parsing
    ├── questionGenerator.js         # Dynamic question generation
    ├── retryUtil.js                 # Centralized retry mechanism with exponential backoff
    ├── sharedExtractors.js         # Common extraction logic
    ├── specificationValidator.js    # Specification validation
    ├── tokenEstimator.js            # Claude API token estimation
    ├── windowSpecParser.js          # Window specification extraction
    └── windowValidator.js          # Window dimension validation

data/               # Database storage (Git-ignored)
logs/               # Log files (Git-ignored)
docs/               # Documentation
public/quotes/      # Generated quote HTML files
```

## Deployment

The application follows a multi-environment deployment strategy:

### Testing Environment (Railway) ✅
- Quick setup with free tier for testing
- Automatic deployments from GitHub
- Environment variables configured in Railway dashboard
- **Status**: Successfully deployed and functional

### Production Environment (Render)
- Reliable hosting for production workloads
- Scalable Web Service with competitive pricing
- Zero-downtime deployments and advanced monitoring

## Documentation

- For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)
- For implementation roadmap, see [ROADMAP.md](ROADMAP.md)
- For conversation context management, see [CONVERSATION_CONTEXT.md](docs/CONVERSATION_CONTEXT.md)
- For admin API documentation, see [ADMIN_API.md](docs/ADMIN_API.md)
- For quote API documentation, see [QUOTE_API.md](docs/QUOTE_API.md)
- For quote management API documentation, see [QUOTE_MANAGEMENT_API.md](docs/QUOTE_MANAGEMENT_API.md)
- For error handling guide, see [ERROR_HANDLING_GUIDE.md](docs/ERROR_HANDLING_GUIDE.md)
- For parser implementation details, see [PARSERS.md](docs/PARSERS.md)
- For parser refactoring guide, see [PARSER_REFACTORING.md](docs/PARSER_REFACTORING.md)
- For testing strategy, see [TEST_STRATEGY.md](docs/TEST_STRATEGY.md)
- For auto-push functionality, see [AUTO-PUSH.md](AUTO-PUSH.md)

## License

[MIT](LICENSE)