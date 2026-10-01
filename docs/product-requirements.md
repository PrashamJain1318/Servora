# Product Requirements Document (PRD) — SERVORA

---

## 1. System Overview & Scope

Servora is an enterprise-grade multi-tenant B2B SaaS platform that enables service businesses to deploy an intelligent, deterministic AI receptionist on their branded public landing page. The platform powers lead capture, automated inquiry handling, accurate price quotes, schedule management, and instant booking creation.

This document formalizes the functional and non-functional requirements for the core modules.

---

## 2. Functional Requirements by Module

### 2.1 Multi-Tenant Organization & Workspace Management
- **FR-ORG-01:** The system shall support multiple independent organizations (tenants).
- **FR-ORG-02:** Every tenant workspace must possess a unique identifier (`organizationId`), a human-readable name, a URL slug (e.g., `servora.app/royal-detailing`), contact details, time zone, currency, and business address.
- **FR-ORG-03:** The slug must be globally unique across all tenants and URL-safe.
- **FR-ORG-04:** Data belonging to Organization A must be completely inaccessible to Organization B under all circumstances.

### 2.2 Authentication, Authorization & User Management
- **FR-AUTH-01:** System authentication shall integrate with Clerk for session lifecycle, token verification, and passwordless/SSO flows.
- **FR-AUTH-02:** The system must implement Role-Based Access Control (RBAC) with five distinct roles:
  1. `PLATFORM_ADMIN`: Global system superuser.
  2. `BUSINESS_OWNER`: Organization creator with full operational, billing, and administrative rights.
  3. `BUSINESS_ADMIN`: Operations manager with permissions to edit services, schedules, staff, bookings, and customer profiles (excluding subscription and company deletion).
  4. `STAFF`: Service provider with read access to their assigned appointments and calendar.
  5. `CUSTOMER`: End consumer who browses, chats, books, reschedules, and views their appointments.
- **FR-AUTH-03:** Users must be able to belong to multiple organizations via a `memberships` entity, with distinct roles per organization.

### 2.3 Service Catalog & Configurable Modifiers
- **FR-SVC-01:** Organizations can create, read, update, archive, and delete services.
- **FR-SVC-02:** Each service must define:
  - Name, category, description, and rich promotional overview.
  - Base duration (in minutes) and cleanup/buffer time required after completion.
  - Base price and currency.
  - Pricing model: `FIXED`, `STARTING_AT`, or `CUSTOM_QUOTE`.
  - Eligible staff members capable of performing this service.
- **FR-SVC-03:** Services must support multi-attribute modifiers:
  - Modifier categories (e.g., "Vehicle Size", "Hair Length", "Property Square Footage").
  - Modifier options (e.g., "Hatchback", "Sedan", "Compact SUV", "Full-Size SUV/Truck").
  - Impact on price (positive/negative flat surcharge or percentage modifier) and duration (additional minutes).

### 2.4 Deterministic Pricing Engine
- **FR-PRC-01:** The system must compute final prices using a purely deterministic calculation service.
- **FR-PRC-02:** Formula:  
  $$\text{Subtotal} = \text{Base Price} + \sum(\text{Modifier Surcharges}) + \sum(\text{Add-on Prices})$$
  $$\text{Discount Amount} = \text{Subtotal} \times \text{Discount Percentage} + \text{Flat Discount}$$
  $$\text{Tax Amount} = (\text{Subtotal} - \text{Discount Amount}) \times \text{Tax Rate}$$
  $$\text{Total Price} = (\text{Subtotal} - \text{Discount Amount}) + \text{Tax Amount}$$
- **FR-PRC-03:** Quotes must return an itemized breakdown (base, modifier adjustments, add-ons, discounts, and taxes).
- **FR-PRC-04:** AI Receptionist must never construct a custom price quote without invoking `calculate_quote`.

### 2.5 Staff & Operational Availability
- **FR-STF-01:** Staff profiles must capture name, email, phone, role, active status, assigned services, and working hours.
- **FR-STF-02:** The system must allow defining weekly recurring business operating hours per organization (e.g., Monday–Saturday 09:00–19:00).
- **FR-STF-03:** The system must allow individual staff working schedules, shift exceptions, and break intervals.
- **FR-STF-04:** The system must support organization-wide and staff-specific holiday/blackout dates.
- **FR-STF-05:** Time zones must be respected: operating hours and slots are stored in UTC with timezone offset metadata and rendered in the business's local timezone.

### 2.6 Booking Engine & Concurrency Control
- **FR-BKG-01:** Real-time slot availability must be determined by computing:
  $$\text{Available Slots} = \text{Business Operating Hours} \cap \text{Staff Working Hours} \setminus (\text{Existing Bookings} \cup \text{Staff Breaks} \cup \text{Holidays} \cup \text{Buffer Times})$$
- **FR-BKG-02:** The system must support a strict booking state machine:
  `PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`, with transitions to `CANCELLED` or `NO_SHOW`.
- **FR-BKG-03:** To prevent double-booking during concurrent checkout/chat requests, the engine must acquire an atomic distributed lock via Redis before confirming slot availability and persisting the booking record.
- **FR-BKG-04:** Customers must be able to cancel or reschedule appointments subject to the business’s cancellation policy (e.g., minimum notice window).

### 2.7 Lead Management & Qualification
- **FR-LED-01:** Any customer who interacts with the AI receptionist and provides contact details (phone or email) without completing a booking must automatically be recorded as a `Lead`.
- **FR-LED-02:** Lead lifecycle stages: `NEW` $\rightarrow$ `CONTACTED` $\rightarrow$ `QUALIFIED` $\rightarrow$ `QUOTED` $\rightarrow$ `BOOKED` or `LOST`.
- **FR-LED-03:** Lead records must preserve extracted intent, interested services, vehicle/custom attributes, budget indicators, conversation transcript links, and last contact timestamps.

### 2.8 Customer CRM
- **FR-CRM-01:** Customer records are scoped per organization and deduplicated by normalized phone number or email address.
- **FR-CRM-02:** A customer profile aggregates appointment history, total spend, cancellation history, communication notes, vehicle/preference tags, and linked lead histories.

### 2.9 AI Receptionist & Tool Calling System
- **FR-AI-01:** The AI receptionist interacts with customers through a conversational widget on the public business website.
- **FR-AI-02:** The AI must utilize model function-calling (tools) for any authoritative information retrieval or write action.
- **FR-AI-03:** Supported tools:
  - `get_business_info` (Operating hours, address, general policies)
  - `get_services` (List catalog with base pricing and descriptions)
  - `get_service_details` (Detailed breakdown of packages and modifiers)
  - `get_availability` (Real-time computed available appointment slots)
  - `calculate_quote` (Deterministic itemized quote calculation)
  - `create_lead` (Captures customer details and intent)
  - `create_booking` (Executes atomic booking reservation)
  - `reschedule_booking` (Modifies confirmed appointment time)
  - `cancel_booking` (Cancels appointment adhering to policy)
- **FR-AI-04:** The AI receptionist must maintain conversation context while truncating or summarizing message history to stay within budget constraints.

### 2.10 Knowledge Base & Vector Search (RAG)
- **FR-RAG-01:** Businesses can supply unstructured and semi-structured knowledge (FAQs, warranty policies, vehicle prep instructions, facility notes).
- **FR-RAG-02:** Knowledge is chunked, embedded, and stored in MongoDB Atlas with Vector Search indexing scoped by `organizationId`.
- **FR-RAG-03:** Information retrieved via RAG must serve solely as contextual knowledge for conversational answers and cannot bypass or override deterministic business logic.

### 2.11 Notifications Engine
- **FR-NTF-01:** The system shall enqueue transactional notifications via BullMQ.
- **FR-NTF-02:** Notifications sent via Resend (Email) for V1 MVP:
  - Immediate booking confirmation (customer and business).
  - Appointment reminder (24 hours and 2 hours prior to scheduled slot).
  - Reschedule confirmation and cancellation notices.
  - New lead alert sent to business owner.

### 2.12 Public Business Landing Page
- **FR-PUB-01:** Dynamic, SEO-optimized public landing page at `servora.app/[slug]` or custom subpaths.
- **FR-PUB-02:** Rendered dynamically using Next.js Server-Side Rendering (SSR) based on the organization's published profile, service catalog, gallery, business hours, and location.
- **FR-PUB-03:** Embedded AI receptionist chat widget and direct booking modal.

---

## 3. Non-Functional Requirements

### 3.1 Security & Multi-Tenancy
- **NFR-SEC-01:** Zero Cross-Tenant Leakage. All database operations must enforce `{ organizationId }` filtering at the query repository layer.
- **NFR-SEC-02:** Prompt injection defense: User input passed to the LLM must be sanitized and wrapped in rigid boundary tags. Tool arguments returned by the LLM must be strictly validated with Zod before execution.
- **NFR-SEC-03:** Webhook integrity: External webhook endpoints (Clerk Svix, Stripe, Razorpay, Resend) must verify signatures using provider-specific cryptographic mechanisms, with Redis event ID deduplication and order-tolerant handler execution.

### 3.2 Performance & Latency
- **NFR-PERF-01:** API response time (non-AI endpoints) must be under 150ms at p95.
- **NFR-PERF-02:** Public business page First Contentful Paint (FCP) must be under 1.2s.
- **NFR-PERF-03:** AI streaming time-to-first-token (TTFT) must be under 1.8s.
- **NFR-PERF-04:** Availability calculation engine must resolve open slots within 80ms for a 14-day lookahead window.

### 3.3 Reliability & Availability
- **NFR-REL-01:** Target 99.9% uptime for core booking and public catalog endpoints.
- **NFR-REL-02:** Worker queues (BullMQ) must implement exponential backoff retry strategies (3 retries with 5s, 30s, 120s delays) for transient third-party failures (e.g., email dispatch).

### 3.4 Cost & AI Resource Governance
- **NFR-COST-01:** Every AI request must log input tokens, output tokens, provider, model, latency, and estimated cost against the tenant’s `ai_usage` ledger.
- **NFR-COST-02:** Automatic caching of static system prompts and deterministic tool definitions to minimize token consumption.
- **NFR-COST-03:** Hard token caps per conversation turn (max 1,000 output tokens) to prevent infinite loops or runaway billing.
