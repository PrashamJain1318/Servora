# System Architecture — SERVORA

---

## 1. High-Level Architectural Vision

Servora is designed as a **modern modular monolith with dedicated background worker processes**. It provides enterprise-grade scalability, developer ergonomics, and low operational overhead without introducing the distributed failure modes, latency penalties, and orchestration complexity of premature microservices.

```mermaid
graph TB
    subgraph Client_Layer ["Client & Edge Layer (Cloudflare)"]
        Browser[Customer Browser / Mobile Web]
        DashboardUser[Business Owner / Admin Browser]
        CF[Cloudflare DNS / Edge SSL / WAF / CDN]
    end

    subgraph Presentation_Layer ["Presentation Tier (Vercel)"]
        NextWeb["Next.js 15 Web Application<br/>- Public Landing Pages (/apex-detailing)<br/>- AI Chatbot Widget<br/>- Business Owner Admin Portal<br/>- Server-Side Rendering (SSR)"]
    end

    subgraph Service_Tier ["Application & Worker Tier (Railway)"]
        NestAPI["NestJS Core API Gateway (Modular Monolith)<br/>- Tenant Interceptors & RBAC<br/>- Booking & Pricing Engines<br/>- AI Receptionist & Tool Dispatcher<br/>- REST / JSON API"]
        Worker["BullMQ Background Worker<br/>- Email Notifications (Resend)<br/>- Lead Follow-up Timers<br/>- Daily Slot Aggregation<br/>- Analytics Flushes"]
    end

    subgraph Data_Tier ["Data & State Persistence Tier"]
        Mongo[("MongoDB Atlas Primary Replica Set<br/>- Multi-tenant Collections<br/>- MongoDB Vector Search Index")]
        Redis[("Upstash Redis<br/>- Distributed Distributed Slot Locks<br/>- BullMQ Job State<br/>- Rate Limiting Token Buckets")]
    end

    subgraph External_Services ["External Cloud Services"]
        Clerk["Clerk Auth (User Sessions & SSO)"]
        OpenAI["OpenAI / Gemini API"]
        Resend["Resend (Transactional Email)"]
        Cloudinary["Cloudinary (Asset & Image CDN)"]
        PostHog["PostHog (Product Analytics)"]
        Sentry["Sentry (Telemetry & Error Tracing)"]
    end

    %% Network Connections
    Browser --> CF
    DashboardUser --> CF
    CF --> NextWeb
    NextWeb --> NestAPI
    NextWeb -.-> Clerk

    NestAPI --> Mongo
    NestAPI --> Redis
    NestAPI --> Clerk
    NestAPI --> OpenAI
    NestAPI --> Sentry
    NestAPI --> PostHog

    NestAPI -.->|Enqueue Jobs| Redis
    Redis -.->|Consume Jobs| Worker
    Worker --> Mongo
    Worker --> Resend
    Worker --> Sentry
```

---

## 2. Monorepo Structure

The project leverages a unified TypeScript workspace powered by **Turborepo** or **pnpm workspaces**:

```
servora/
│
├── apps/
│   ├── web/                     # Next.js 15 App Router (Public landing + Business dashboard)
│   ├── api/                     # NestJS REST API Gateway & Business Logic Modules
│   └── worker/                  # BullMQ Background Job Processor
│
├── packages/
│   ├── ui/                      # Shared React UI components (shadcn/ui, Radix, Tailwind)
│   ├── types/                   # Universal TypeScript interfaces, enums, and DTOs
│   ├── validation/              # Zod validation schemas shared by Frontend & Backend
│   └── config/                  # Shared ESLint, Prettier, and TypeScript configurations
│
├── docs/                        # Complete Phase 0 Architectural Documentation
├── scripts/                     # Seed scripts, migration utilities, and local dev helpers
├── .github/
│   └── workflows/               # CI/CD pipelines (Lint, Test, Typecheck, Deploy)
├── package.json                 # Monorepo root configuration
├── turbo.json                   # Pipeline build & cache orchestration
└── README.md
```

### Module Responsibilities within `apps/api` (Modular Monolith)
Inside `apps/api/src/modules/`, each domain operates with clear boundaries:
- `auth/`: Clerk webhook verification, user syncing, and RBAC guards.
- `organizations/`: Workspace creation, business profile, and tenant settings.
- `services/`: Service catalog, modifier rules, and duration metadata.
- `staff/`: Technician rosters, working shifts, and individual blackout dates.
- `availability/`: Schedule matrix computation and open slot lookups.
- `pricing/`: Pure, deterministic calculation engine for quotes.
- `bookings/`: Atomic reservations, state machine transitions, and concurrency locking.
- `customers/`: CRM contact profiles, history aggregation, and notes.
- `leads/`: Lead capture, scoring, and status transitions.
- `ai/`: Model abstraction, receptionist conversational controller, and tool router.
- `knowledge/`: Business FAQs, policies, and vector embeddings.
- `notifications/`: BullMQ queue producer for asynchronous dispatch.

---

## 3. High-Level Data Flow

The following diagram maps the lifecycle of customer requests and background tasks across runtime tiers:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Inbound Customer
    participant Web as Next.js Web (Public)
    participant API as NestJS Gateway
    participant Redis as Redis (Upstash)
    participant Mongo as MongoDB Atlas
    participant AI as OpenAI / Gemini
    participant Worker as BullMQ Worker
    participant Resend as Resend Email

    Customer->>Web: Submits Inquiry on servora.app/apex-detailing
    Web->>API: POST /api/v1/ai/chat (Prompt, ConversationId, Tenant Context)
    API->>API: Validate Session, Apply Rate Limit (Upstash)
    API->>Mongo: Fetch Organization Context & Vector Search (FAQ Knowledge)
    API->>AI: Send System Prompt + Business Data + Tools Schema
    AI-->>API: Tool Call: calculate_quote(...)
    API->>API: Execute Pricing Engine (Deterministic)
    API-->>AI: Tool Output: { quote: 27140, breakdown: [...] }
    AI-->>API: Formatted natural conversational response
    API->>Mongo: Store Messages in conversations collection
    API-->>Web: Stream response to Customer
    Customer->>Web: Confirms Booking Selection
    Web->>API: POST /api/v1/bookings/reserve
    API->>Redis: Acquire Atomic Slot Lock
    API->>Mongo: Insert Booking & Update Customer Record
    API->>Redis: Release Slot Lock
    API->>Redis: Enqueue 'send_booking_notification' job
    API-->>Web: Booking Confirmed (HTTP 201)
    Worker->>Redis: Dequeue 'send_booking_notification'
    Worker->>Resend: Dispatch Confirmation Emails
    Worker->>Mongo: Update Notification Log
```

---

## 4. Key Architectural Decisions & Rationales

### 4.1 Modular Monolith vs. Microservices
- **Decision:** Build a single NestJS backend (`apps/api`) with a background worker (`apps/worker`), rather than splitting into separate service microservices.
- **Rationale:** At this stage of development, microservices introduce cross-boundary network latency, complex distributed transactions, duplicated schema validation, and multi-repo deployment overhead. A modular monolith provides strict internal separation of concerns via NestJS dependency injection modules while running as a single, highly performant unit.

### 4.2 MongoDB Atlas as Primary Datastore
- **Decision:** MongoDB Atlas with Mongoose.
- **Rationale:** Flexible schema support for polymorphic service modifiers, dynamic business hours, nested booking items, conversational transcripts, and native Atlas Vector Search. MongoDB 4.0+ multi-document ACID transactions provide atomic consistency when finalizing bookings.

### 4.3 Redis for Concurrency & Asynchronous Queuing
- **Decision:** Upstash Redis powering BullMQ and distributed locks.
- **Rationale:** Eliminates race conditions in booking creation through sub-millisecond atomic locking (`SET key val NX EX`). Offloads non-critical work (email delivery, lead alerts, telemetry logging) to background workers.
