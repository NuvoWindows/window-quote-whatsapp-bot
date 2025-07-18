# Window Quote WhatsApp Bot - Architecture Documentation

## Overview

This document outlines the architecture of the Window Quote WhatsApp Bot, a service that provides automated window installation price quotes via WhatsApp using Claude AI.

## System Architecture

```
┌───────────────────┐      ┌─────────────────────────────┐      ┌─────────────────┐
│                   │      │                             │      │                 │
│  WhatsApp API     │──────▶  Express Server             │──────▶  Claude AI      │
│  (Meta Graph API) │◀─────│  (Node.js)                  │◀─────│  (Anthropic)    │
│                   │      │                             │      │                 │
└───────────────────┘      └───────────┬─────────────────┘      └─────────────────┘
                                       │   ▲
                                       ▼   │
                           ┌────────────────────────────┐
                           │                            │
                           │  Conversation Manager      │
                           │                            │
                           └────────────┬───────────────┘
                                        │   ▲
                                        ▼   │
                           ┌────────────────────────────┐
                           │                            │
                           │  SQLite Database           │
                           │  (Persistent Storage)      │
                           │                            │
                           └────────────────────────────┘
```

## Component Breakdown

### 1. Express Server (Node.js)

The core application is built on Express.js, handling HTTP requests and routing them to appropriate controllers.

**Key Components:**
- **Express App**: Main application instance
- **Middleware**: CORS, JSON and URL-encoded body parsing
- **Routes**: API routes for webhooks and quote generation
- **Health Check**: Simple endpoint to verify the server is running

### 2. WhatsApp Integration

The application integrates with WhatsApp Business API via Meta's Graph API to send and receive messages.

**Key Components:**
- **WhatsApp Service**: Handles message sending and marking messages as read
- **WhatsApp Controller**: Manages webhook processing with message deduplication
  - Implements message ID caching to prevent duplicate processing
  - Maintains TTL-based cache with automatic cleanup
  - Ensures each webhook is processed only once
- **Webhook Verification**: Verifies the webhook with Meta's verification process
- **Message Handling**: Processes incoming messages and crafts responses

### 3. Claude AI Integration

Claude 3 Haiku is used to generate conversational responses based on the user's messages.

**Key Components:**
- **Claude Service**: Interfaces with Anthropic's API to generate responses
  - Integrated retry mechanisms with exponential backoff
  - Service-specific error detection for retryable failures
  - Environment variable configuration for retry parameters
- **System Prompt**: Guides Claude to gather necessary information for a window quote
- **Conversation Context**: Maintains context through multiple messages

### 4. Quote Calculation

The application provides comprehensive window installation quotes based on detailed specifications.

**Key Components:**
- **Quote Service** (`quoteService.js`): Core pricing engine for window calculations
  - Base pricing tables by window operation type and square footage
  - Operation-specific pricing for Hung, Slider, Fixed, Casement, and Awning windows
  - Specialized pricing for shaped windows with arched tops
  - Bay window pricing with header/footer and exterior siding options
  - Support for optional features (Low-E glass, grilles, tinted/frosted glass)
  - Quantity-based discount calculation
  - Installation pricing based on window type and size
- **Multi-Window Quote Service** (`multiWindowQuoteService.js`): Database layer for quote management
  - Creates, reads, updates, and deletes quotes with multiple windows
  - Manages quote status workflow (draft, complete, revision)
  - Generates HTML/PDF quote files
  - Uses Quote Service for pricing calculations
  - Handles database persistence and retrieval
- **Quote Detail Service**: Generates detailed HTML quotes for customers
- **Specification Validator** (`specificationValidator.js`): Validates specifications and identifies missing fields
  - Identifies missing required fields
  - Prioritizes fields by importance
  - Determines if specifications are complete
- **Question Generator** (`questionGenerator.js`): Generates contextual questions
  - Creates questions based on missing fields
  - Considers already-known information
  - Prioritizes questions by importance
- **Ambiguity Detector** (`ambiguityDetector.js`): Detects and resolves ambiguous inputs
  - Identifies ambiguous terms in user messages
  - Suggests clarifications and defaults
  - Resolves ambiguity based on user responses
- **Message Parser** (`messageParser.js`): Extracts window specifications from single messages
  - Parses individual messages for window details
  - Returns structured data from natural language
  - Used during real-time conversation processing
  - Includes integrated validation of specifications
- **Window Specification Parser** (`windowSpecParser.js`): Extracts specifications from conversation history
  - Processes arrays of messages (full conversations)
  - Handles multiple windows in a single conversation
  - Groups windows by location or number
  - Used for batch processing and quote generation
- **Shared Extractors** (`sharedExtractors.js`): Common extraction logic
  - Eliminates code duplication between parsers
  - Central location for pattern matching
  - Currently includes: dimensions, operation type, location, window type, pane count, options
  - Ensures consistency across both parsers
  - Returns raw extracted data without validation
- **Window Validator** (`windowValidator.js`): Validates extracted specifications
  - Validates dimension ranges (12" min, 120" max)
  - Provides user-friendly error messages
  - Suggests corrections for common errors
  - Logs validation failures for analysis
  - Validates unit conversions
- **Retry Util** (`retryUtil.js`): Centralized retry mechanism
  - Exponential backoff with jitter
  - Configurable retry parameters
  - Service-agnostic implementation

**Service Separation Rationale:**
- `quoteService.js` focuses solely on pricing calculations (business logic)
- `multiWindowQuoteService.js` handles database operations and quote lifecycle
- This separation allows the pricing engine to be used independently and tested in isolation

### 5. Conversation Context Management

The application uses a persistent SQLite database to maintain conversation context.

**Key Components:**
- **Conversation Manager**: Central service that handles conversation persistence and retrieval
  - Supports partial specification storage
  - Handles conversation deferrals and resumptions
  - Manages clarification states
- **SQLite Database**: Stores conversations, messages, and structured window specifications
- **Context Optimization**: Enhances conversations with previously extracted window specifications
- **Context Summarization**: Intelligently summarizes long conversations to manage token limits
- **Token Estimation**: Calculates and manages token usage for Claude API requests
- **Window Specification Parser**: Extracts structured data from conversation messages
- **Expiry Mechanism**: Automatically purges old conversations after 30 days

### 6. Error Handling and Recovery

Comprehensive error handling system for graceful failure recovery.

**Key Components:**
- **Conversation Flow Service** (`conversationFlowService.js`): Manages conversation flow
  - Handles returning users with partial specifications
  - Manages conversation resumption
  - Applies defaults for expired conversations
  - Saves progress after each interaction
  - Integrates with clarification and measurement services
- **Clarification Service** (`clarificationService.js`): Handles ambiguous inputs
  - Generates context-aware clarification requests
  - Processes user clarifications
  - Tracks pending clarifications
  - Prioritizes ambiguities based on importance
- **Error Context Service** (`errorContextService.js`): Preserves error context
  - Captures comprehensive error information
  - Determines conversation phase during errors
  - Saves error context for recovery
  - Provides context for retry decisions
- **Error Recovery Service** (`errorRecoveryService.js`): Implements recovery strategies
  - Different strategies for different error types
  - Context-aware recovery messages
  - Integration with retry mechanisms
  - Graceful degradation options
- **Error Monitoring Service** (`errorMonitoringService.js`): Pattern detection and alerting
  - Multiple detection strategies (frequency, user impact, error chains, time correlation)
  - Priority-based alerting across multiple channels (console, Slack, email, PagerDuty)
  - Service health calculation and metrics
  - Dashboard integration for visualization
  - Error pattern aggregation and analysis
- **Retry Util** (`retryUtil.js`): Centralized retry mechanism
  - Exponential backoff with jitter
  - Configurable retry limits and delays
  - Context-aware retry decisions
  - Integration with error monitoring
- **Professional Measurement Service** (`professionalMeasurementService.js`): Lead generation
  - Assesses measurement complexity
  - Offers professional measurement scheduling
  - Extracts and validates contact information
  - Creates measurement leads
- **Measurement Deferral Service** (`measurementDeferralService.js`): Deferred quotes
  - Allows users to defer measurements
  - Manages resumption of deferred conversations
  - Tracks missing information
  - Provides helpful resources

## Data Flow

1. **Incoming Message Flow**:
   - User sends a message via WhatsApp
   - Meta delivers the message to the webhook endpoint
   - WhatsApp controller processes the message
   - Conversation Manager retrieves or creates conversation context
   - User message is persisted to the database
   - Specification parser attempts to extract window details
   - Context is optimized with any previously stored specifications
   - Long conversations are summarized to stay within token limits
   - Claude generates a response based on the enhanced and optimized context
   - Assistant response is persisted to the database
   - Response is sent back to the user via WhatsApp

2. **Quote Generation Flow**:
   - User message contains window specifications
   - Message parser extracts dimensions, window type, pane count, options, operation type, etc.
   - Quote service calculates a detailed estimate based on comprehensive pricing variables
   - For shaped windows, specialized pricing is applied based on diameter
   - For bay windows, additional costs for header/footer and exterior siding are calculated
   - Quantity discounts are applied for multiple windows
   - Optional features (Low-E, grilles, frosted glass, etc.) are factored into pricing
   - Quote detail service can generate an HTML breakdown of the quote
   - Response includes detailed pricing information, installation cost, and a link to view the full quote

## API Endpoints

### WhatsApp API
- `GET /api/webhook`: Webhook verification for WhatsApp API
- `POST /api/webhook`: Webhook to receive WhatsApp messages
- `GET /health`: Health check endpoint

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
- `GET /api/quote-management/quotes/conversation/:conversationId`: Get quotes by conversation
- `POST /api/quote-management/quotes/from-conversation/:conversationId`: Create a quote from conversation

### Admin API
- `GET /admin/conversations`: List all active conversations
- `GET /admin/conversations/:userId`: Get details for a specific conversation
- `DELETE /admin/conversations/:userId`: Delete a specific conversation
- `POST /admin/expire-conversations`: Force expire old conversations
- `GET /admin/errors/dashboard`: Error monitoring dashboard data
- `GET /admin/errors/stats`: Error statistics by category

## Environment Configuration

The application leverages environment variables for configuration, which are loaded through the `dotenv` package.

### Required Environment Variables

```
# Server Configuration
PORT=3000                        # Port the Express server runs on

# WhatsApp API Configuration
WHATSAPP_API_VERSION=v19.0       # Meta Graph API version
WHATSAPP_PHONE_NUMBER_ID=123456  # WhatsApp phone number ID from Meta developer dashboard
WHATSAPP_ACCESS_TOKEN=xxx        # WhatsApp API access token
WHATSAPP_VERIFY_TOKEN=xxx        # Custom verification token for webhook verification

# Claude AI Configuration
CLAUDE_API_KEY=sk-ant-xxx        # Anthropic API key for Claude AI
CLAUDE_MAX_RETRIES=3             # Maximum number of retry attempts
CLAUDE_RETRY_BASE_DELAY_MS=300   # Base delay for exponential backoff
CLAUDE_RETRY_MAX_DELAY_MS=3000   # Maximum delay between retries

# Logging Configuration
LOG_LEVEL=info                   # Logging level (debug, info, warn, error)
LOG_TO_FILE=true                 # Whether to write logs to files
LOG_DIR=logs                     # Directory for log files
MAX_LOG_SIZE=10485760            # Maximum log file size (10MB)
MAX_LOG_FILES=10                 # Maximum number of rotated log files
REDACT_PII=false                 # Whether to redact personal information in logs

# Database Configuration
DB_PATH=./data/bot.db            # Path to SQLite database file
CONVERSATION_EXPIRY_DAYS=30      # Days before conversations are expired

# Admin Interface Configuration
ADMIN_TOKEN=xxx                  # Secret token for admin API authentication
```

### Environment Setup

1. **Development**:
   - Variables are loaded from a `.env` file in the project root
   - `nodemon` is used to automatically restart the server on file changes

2. **Production**:
   - Environment variables are configured directly in the Railway deployment platform
   - Secure storage of credentials without exposing in source control

### Configuration Management

The `config.js` file centralizes all environment variables and provides them to the application. This allows for:

- Single source of truth for configuration
- Type checking and default values
- Isolation of environment-specific logic

## Security Considerations

- WhatsApp webhook verification ensures messages are from valid sources
- API keys are stored as environment variables
- Token-based authentication for admin API
- SQLite database with proper permissions
- Error handling prevents sensitive information leakage
- Option to redact personal information in logs (configurable)

## Deployment Architecture

The application uses a multi-environment deployment strategy with Railway for testing and Render for production.

### Infrastructure Overview

```
┌─────────────┐
│             │     ┌─────────────────────┐     ┌─────────────────────┐
│  GitHub     │────▶│  Railway (Testing)  │     │  Render (Production)│
│  Repository │     └─────────────────────┘     └─────────────────────┘
│             │─────────────────────────────────▶
└─────────────┘
```

### Testing Environment (Railway)

Railway is used as the testing environment due to its simplicity and free tier offerings.

#### Infrastructure Components

- **Runtime**: Node.js v18+ environment
- **Compute**: Serverless container with auto-scaling capabilities
- **Networking**: Automatic HTTPS and custom domain support
- **Monitoring**: Built-in logging and performance metrics

#### Deployment Process

```
┌─────────────┐     ┌───────────────┐     ┌────────────────┐     ┌─────────────┐
│             │     │               │     │                │     │             │
│  GitHub     │────▶│  Railway      │────▶│  Containerized │────▶│  Testing    │
│  Repository │     │  Build Process│     │  Application   │     │  Environment│
│             │     │               │     │                │     │             │
└─────────────┘     └───────────────┘     └────────────────┘     └─────────────┘
```

1. **Source Control**: GitHub repository holds all application code
2. **CI/CD Pipeline**:
   - Automatic deployments triggered by commits to the main branch
   - Environment variables securely configured in the Railway dashboard
   - Build logs available for troubleshooting
3. **Runtime Environment**:
   - Containerized Node.js application
   - Automatic SSL certificate provisioning
   - Public HTTPS endpoint for the webhook

### Production Environment (Render)

Render is used for production deployments due to its reliability, scalability, and competitive pricing.

#### Infrastructure Components

- **Runtime**: Node.js environment with version selection
- **Compute**: Web Service with auto-scaling capabilities
- **Networking**: Automatic HTTPS, custom domain support, and global CDN
- **Monitoring**: Advanced logging, metrics, and health checks

#### Deployment Process

```
┌─────────────┐     ┌───────────────┐     ┌────────────────┐     ┌─────────────┐
│             │     │               │     │                │     │             │
│  GitHub     │────▶│  Render       │────▶│  Deployed      │────▶│  Production │
│  Repository │     │  Build Process│     │  Application   │     │  Environment│
│             │     │               │     │                │     │             │
└─────────────┘     └───────────────┘     └────────────────┘     └─────────────┘
```

1. **Source Control**: GitHub repository integration
2. **CI/CD Pipeline**:
   - Automatic deployments on push to specified branches
   - Environment variables securely stored in Render dashboard
   - Build and deployment logs
3. **Runtime Environment**:
   - Optimized container deployment
   - Automatic SSL/TLS certificate management
   - Deploy preview environments for pull requests (optional)

### Scaling Considerations

#### Railway (Testing)
- **Vertical Scaling**: Adjustable RAM and CPU allocation
- **Horizontal Scaling**: Support for multiple instances if needed
- **Cold Starts**: Minimal impact due to Railway's container management

#### Render (Production)
- **Auto-scaling**: Configure minimum and maximum instance counts
- **Resource Allocation**: Adjustable RAM and CPU settings
- **Regions**: Multi-region deployment options for reduced latency
- **Zero-downtime Deploys**: Seamless updates without service interruption

### Networking

- **Ingress**: Public HTTPS endpoint for the WhatsApp webhook
- **Egress**: Secure outbound connections to:
  - WhatsApp Graph API (for sending messages)
  - Anthropic API (for Claude AI responses)
- **Custom Domain**: Configurable with CNAME records for both platforms

## Development Environment

### Local Development Setup

1. **Prerequisites**:
   - Node.js v18+ installed
   - npm or yarn package manager
   - Git for version control
   - ngrok for webhook testing (optional)

2. **Installation Steps**:
   ```bash
   # Clone repository
   git clone <repository-url>
   cd window-quote-whatsapp-bot

   # Install dependencies
   npm install

   # Set up environment
   cp .env.example .env
   # Edit .env with your credentials

   # Start development server
   npm run dev
   ```

3. **Testing Webhooks Locally**:
   - Use ngrok to create a secure tunnel to localhost:
     ```bash
     npx ngrok http 3000
     ```
   - Configure the ngrok URL in the Meta Developer Portal

### Development Workflow

1. **Branch Strategy**:
   - `main`: Production-ready code
   - Feature branches: For new features and bug fixes

2. **Code Changes**:
   - Make changes in feature branches
   - Test locally with ngrok for webhook functionality
   - Create pull requests to merge into main

3. **Deployment**:
   - Commits to main trigger automatic deployment on Railway
   - Monitor deployment logs for any issues

## Future Enhancements

Potential areas for enhancement include:

### Technical Improvements
- Migration to a more robust database (PostgreSQL/MongoDB) for production scale
- Webhook signature validation for enhanced security
- Rate limiting and request throttling

### Quote System Enhancements
- ✅ Database-backed quote storage with unique quote IDs
- ✅ Support for multi-window quotes in a single project
- ✅ Quote status tracking (draft, complete, revision)
- Enhanced quote documents with company branding
- Email delivery of quote PDFs
- Quote comparison and revision history
- Further enhancements to context summarization algorithms
- Expansion of unit and integration testing suite

### Functional Enhancements
- User authentication for direct quote API access
- Additional window specification options
- Image recognition for window measurements
- Multi-language support
- Scheduling capabilities for follow-up consultations

### Business Intelligence
- Analytics dashboard for conversation metrics
- Quote conversion tracking
- User satisfaction measurement
- A/B testing framework for response variations
- Integration with CRM systems

## Sequence Diagrams

### WhatsApp Message Processing

```
┌────────┐      ┌─────────┐      ┌───────────────┐      ┌───────────┐      ┌──────┐
│WhatsApp│      │Webhook  │      │Conversation   │      │Claude     │      │Quote │
│API     │      │Controller│      │Manager       │      │Service    │      │Service│
└───┬────┘      └────┬────┘      └──────┬────────┘      └─────┬─────┘      └───┬──┘
    │                │                   │                     │                │
    │ POST /webhook  │                   │                     │                │
    │───────────────>│                   │                     │                │
    │                │                   │                     │                │
    │                │ Mark message read │                     │                │
    │<───────────────│                   │                     │                │
    │                │                   │                     │                │
    │                │ Get conversation  │                     │                │
    │                │─────────────────>│                     │                │
    │                │                   │                     │                │
    │                │<─────────────────│                     │                │
    │                │                   │                     │                │
    │                │ Add user message  │                     │                │
    │                │─────────────────>│                     │                │
    │                │                   │                     │                │
    │                │<─────────────────│                     │                │
    │                │                   │                     │                │
    │                │ Get context       │                     │                │
    │                │─────────────────>│                     │                │
    │                │                   │                     │                │
    │                │<─────────────────│                     │                │
    │                │                   │                     │                │
    │                │ Generate response │                     │                │
    │                │─────────────────────────────────────>│                │
    │                │                   │                     │                │
    │                │                   │                     │ Calculate quote│
    │                │                   │                     │───────────────>│
    │                │                   │                     │                │
    │                │                   │                     │<───────────────│
    │                │                   │                     │                │
    │                │<─────────────────────────────────────│                │
    │                │                   │                     │                │
    │                │ Add assistant msg │                     │                │
    │                │─────────────────>│                     │                │
    │                │                   │                     │                │
    │                │<─────────────────│                     │                │
    │                │                   │                     │                │
    │ Send message   │                   │                     │                │
    │<───────────────│                   │                     │                │
    │                │                   │                     │                │
```

## Code Organization

```
src/
├── config/         # Configuration settings
│   └── config.js   # Environment variables and settings
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
│   ├── claudeService.js             # Claude AI integration
│   ├── clarificationService.js      # Ambiguity clarification
│   ├── claudeService.js             # Claude AI integration
│   ├── conversationFlowService.js   # Conversation flow management
│   ├── conversationManager.js       # Conversation persistence
│   ├── errorContextService.js       # Error context preservation
│   ├── errorMonitoringService.js    # Error pattern monitoring
│   ├── errorRecoveryService.js      # Error recovery strategies
│   ├── measurementDeferralService.js # Measurement deferral handling
│   ├── multiWindowQuoteService.js   # Multi-window quote management
│   ├── professionalMeasurementService.js # Professional measurement leads
│   ├── quoteDetailService.js        # Quote HTML generation
│   ├── quoteService.js              # Quote calculation logic
│   └── whatsappService.js           # WhatsApp API integration
├── utils/          # Utility functions
│   ├── ambiguityDetector.js         # Ambiguous term detection
│   ├── contextSummarizer.js         # Conversation summarization
│   ├── database.js                  # SQLite database management
│   ├── logger.js                    # Enhanced structured logging
│   ├── messageParser.js             # WhatsApp message parsing
│   ├── questionGenerator.js         # Dynamic question generation
│   ├── retryUtil.js                 # Centralized retry mechanism
│   ├── sharedExtractors.js         # Common extraction logic
│   ├── specificationValidator.js    # Specification validation
│   ├── tokenEstimator.js           # Token usage estimation
│   ├── windowSpecParser.js          # Window specification extraction
│   └── windowValidator.js          # Window dimension validation
└── index.js        # Application entry point

data/               # SQLite database storage (Git-ignored)
logs/               # Application logs (Git-ignored)
docs/               # Technical documentation
│   ├── ADMIN_API.md                 # Admin API documentation
│   ├── CONVERSATION_CONTEXT.md      # Conversation context system documentation
│   ├── QUOTE_MANAGEMENT_API.md      # Multi-window quote API documentation
│   ├── SYSTEM_PROMPT.md             # Claude system prompt documentation
│   └── TEST_STRATEGY.md             # Testing strategy documentation
public/             # Public assets
└── quotes/                          # Generated quote HTML files
```