# Window Quote WhatsApp Bot - Architecture Documentation

## Overview

This document outlines the architecture of the Window Quote WhatsApp Bot, a service that provides automated window installation price quotes via WhatsApp using Claude AI.

## System Architecture

```
┌───────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│                   │      │                     │      │                 │
│  WhatsApp API     │──────▶  Express Server     │──────▶  Claude AI      │
│  (Meta Graph API) │◀─────│  (Node.js)          │◀─────│  (Anthropic)    │
│                   │      │                     │      │                 │
└───────────────────┘      └─────────────────────┘      └─────────────────┘
                                    │   ▲
                                    ▼   │
                            ┌─────────────────────┐
                            │                     │
                            │  In-Memory Storage  │
                            │  (Conversation      │
                            │   Context)          │
                            │                     │
                            └─────────────────────┘
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
- **Webhook Verification**: Verifies the webhook with Meta's verification process
- **Message Handling**: Processes incoming messages and crafts responses

### 3. Claude AI Integration

Claude 3 Haiku is used to generate conversational responses based on the user's messages.

**Key Components:**
- **Claude Service**: Interfaces with Anthropic's API to generate responses
- **System Prompt**: Guides Claude to gather necessary information for a window quote
- **Conversation Context**: Maintains context through multiple messages

### 4. Quote Calculation

The application can calculate window installation quotes based on provided information.

**Key Components:**
- **Quote Service**: Calculates estimates based on window specifications
- **Message Parser**: Extracts window specifications from natural language input

### 5. In-Memory Storage

The application uses in-memory storage to maintain conversation context.

**Key Components:**
- **Conversations Map**: Stores conversation history by phone number
- **Context Management**: Maintains the last 10 messages for context

## Data Flow

1. **Incoming Message Flow**:
   - User sends a message via WhatsApp
   - Meta delivers the message to the webhook endpoint
   - WhatsApp controller processes the message
   - Message is added to the conversation history
   - Claude generates a response based on the message and conversation history
   - Response is sent back to the user via WhatsApp

2. **Quote Generation Flow**:
   - User message contains window specifications
   - Message parser extracts dimensions, window type, pane count, and options
   - Quote service calculates an estimate
   - Response includes the price range and installation cost

## API Endpoints

- `GET /api/webhook`: Webhook verification for WhatsApp API
- `POST /api/webhook`: Webhook to receive WhatsApp messages
- `POST /api/generate-quote`: Direct endpoint to generate a window installation quote
- `GET /health`: Health check endpoint

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
- Error handling prevents sensitive information leakage

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
- Database integration for persistent conversation storage
- Webhook signature validation for enhanced security
- Rate limiting and request throttling
- Comprehensive error handling and monitoring
- Unit and integration testing suite

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
┌────────┐          ┌─────────┐          ┌───────────┐          ┌──────┐
│WhatsApp│          │Webhook  │          │Claude     │          │Quote │
│API     │          │Controller│          │Service    │          │Service│
└───┬────┘          └────┬────┘          └─────┬─────┘          └───┬──┘
    │                    │                     │                    │
    │ POST /webhook      │                     │                    │
    │───────────────────>│                     │                    │
    │                    │                     │                    │
    │                    │ Mark message as read│                    │
    │<───────────────────│                     │                    │
    │                    │                     │                    │
    │                    │ Generate response   │                    │
    │                    │────────────────────>│                    │
    │                    │                     │                    │
    │                    │                     │ Calculate estimate │
    │                    │                     │───────────────────>│
    │                    │                     │                    │
    │                    │                     │<───────────────────│
    │                    │<────────────────────│                    │
    │                    │                     │                    │
    │ Send message       │                     │                    │
    │<───────────────────│                     │                    │
    │                    │                     │                    │
```

## Code Organization

```
src/
├── config/         # Configuration settings
│   └── config.js   # Environment variables and settings
├── controllers/    # Route controllers
│   ├── quoteController.js   # Quote generation controller
│   └── whatsappController.js # WhatsApp webhook controller
├── routes/         # API routes
│   └── whatsappRoutes.js    # Express routes definitions
├── services/       # Business logic
│   ├── claudeService.js     # Claude AI integration
│   ├── quoteService.js      # Quote calculation logic
│   └── whatsappService.js   # WhatsApp API integration
├── utils/          # Utility functions
│   └── messageParser.js     # Extract info from messages
└── index.js        # Application entry point
```