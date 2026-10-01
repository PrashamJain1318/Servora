# API Architecture & Endpoint Specifications — SERVORA

---

## 1. API Design Principles & Conventions

- **Protocol & Format:** RESTful JSON over HTTPS.
- **Base Version Prefix:** `/api/v1`
- **Authentication:** Bearer JWT in `Authorization` header verified by Clerk for dashboard endpoints; public tenant slug resolution for customer-facing endpoints.
- **Tenant Context:** Authenticated requests supply `x-organization-id` header; public requests resolve from the URL path (`/public/:slug/...`).
- **Idempotency:** Critical write operations (`POST /bookings/reserve`, `POST /payments/*`) accept an `Idempotency-Key` header stored in Redis with 24-hour TTL.
- **Standard HTTP Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests`, `500 Internal Server Error`.

---

## 2. API Route Groups Overview

```
/api/v1/
├── auth/            # User profile sync & session inspection
├── organizations/   # Workspace profile, branding, and team members
├── services/        # Service catalog, categories, and modifiers
├── staff/           # Technicians, assignments, and shifts
├── availability/    # Real-time slot calculation and operating hours
├── bookings/        # Reservation creation, rescheduling, and status transitions
├── customers/       # CRM contact records, preferences, and booking history
├── leads/           # Captured inquiries, qualification pipeline, and scoring
├── ai/              # AI receptionist conversational streaming & tool calls
├── payments/        # Offline / studio payment logging
├── subscriptions/   # Servora B2B SaaS subscription lifecycle
├── analytics/       # Operational metrics and AI token cost rollups
└── webhooks/        # Cryptographically signed third-party event webhooks
```

---

## 3. Key Endpoint Specifications

### 3.1 AI Receptionist Conversation Stream
- **Endpoint:** `POST /api/v1/ai/chat`
- **Purpose:** Process customer message, execute required tools, and return streaming response.
- **Auth:** Public / Anonymous (Session tracked via client `visitorId` and `conversationId`).
- **Rate Limit:** 30 requests / minute per IP or conversation.
- **Request Body:**
  ```json
  {
    "organizationSlug": "apex-detailing",
    "conversationId": "conv_8912",
    "message": "Hi, what does ceramic coating cost for a BMW X5?",
    "visitorId": "vis_991823"
  }
  ```
- **Response:** Server-Sent Events (SSE) streaming text tokens or tool execution events.
- **Error Responses:** `400 Bad Request` (Zod error), `404 Not Found` (Invalid slug), `429 Too Many Requests`.

---

### 3.2 Slot Availability Query
- **Endpoint:** `GET /api/v1/public/:slug/availability`
- **Purpose:** Retrieve all verified, bookable appointment intervals for a service across a date range.
- **Auth:** Public / Anonymous.
- **Rate Limit:** 60 requests / minute.
- **Query Parameters:** `serviceId` (string), `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD).
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "slots": [
        {
          "startTime": "2026-10-03T10:00:00.000Z",
          "endTime": "2026-10-03T14:30:00.000Z",
          "availableStaffIds": ["stf_01", "stf_02"]
        }
      ]
    }
  }
  ```

---

### 3.3 Atomic Booking Reservation
- **Endpoint:** `POST /api/v1/bookings/reserve`
- **Purpose:** Lock slot, validate availability, persist booking, and enqueue confirmation.
- **Auth:** Public / Anonymous with Captcha verification OR Authenticated Session.
- **Idempotency:** Header `Idempotency-Key` required.
- **Rate Limit:** 10 requests / minute per IP.
- **Request Body:**
  ```json
  {
    "organizationSlug": "apex-detailing",
    "serviceId": "svc_102",
    "startTime": "2026-10-03T10:00:00.000Z",
    "selectedModifiers": [
      { "modifierId": "mod_veh_size", "optionLabel": "Full-Size SUV" }
    ],
    "customer": {
      "name": "Ananya Sharma",
      "phone": "+919876543210",
      "email": "ananya@example.com"
    },
    "notes": "Vehicle has minor water spots on hood"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "bookingId": "bkg_90123",
      "bookingReference": "BK-4401",
      "status": "CONFIRMED",
      "startTime": "2026-10-03T10:00:00.000Z",
      "endTime": "2026-10-03T14:30:00.000Z",
      "totalAmount": 27140,
      "currency": "INR"
    }
  }
  ```
- **Error Responses:**
  - `409 Conflict`: Slot was locked or reserved by another request concurrently.
  - `422 Unprocessable Entity`: Customer details failed validation or service is inactive.

---

### 3.4 Service Catalog Management
- **Endpoint:** `POST /api/v1/services`
- **Purpose:** Create a new service with pricing and modifiers.
- **Auth:** Authenticated (`Bearer JWT`).
- **Authorization:** `BUSINESS_OWNER` or `BUSINESS_ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Graphene Coating 5-Year",
    "category": "Coating",
    "description": "Premium 10H graphene oxide protection",
    "basePrice": 32000,
    "pricingModel": "FIXED",
    "baseDurationMinutes": 360,
    "bufferAfterMinutes": 45,
    "modifiers": [
      {
        "id": "mod_size",
        "name": "Vehicle Class",
        "options": [
          { "label": "Sedan", "priceAdjustment": 0, "durationAdjustment": 0 },
          { "label": "SUV", "priceAdjustment": 6000, "durationAdjustment": 60 }
        ]
      }
    ]
  }
  ```
- **Response (201 Created):** Returns inserted service document.

---

### 3.5 Third-Party Webhook Receiver
- **Endpoint:** `POST /api/v1/webhooks/:provider` (e.g. `clerk`, `resend`, `stripe`, `razorpay`)
- **Purpose:** Ingest external events asynchronously into the system.
- **Provider-Specific Authentication & Verification:**
  - `clerk`: Verified via Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) using `@clerk/backend` `verifyWebhook()`.
  - `stripe`: Verified via `stripe-signature` using `stripe.webhooks.constructEvent()`.
  - `razorpay`: Verified via `x-razorpay-signature` using HMAC-SHA256 hash validation.
  - `resend`: Verified via Svix-based signing secret.
- **Idempotency & Replay Protection:** Handlers check Redis for event ID deduplication (`webhook:<provider>:<eventId>`) with a 24-hour expiration window. Duplicate deliveries return immediate `200 OK`.
- **Order Tolerance:** Asynchronous BullMQ workers execute updates using timestamp-aware atomic upserts (`$max`) to gracefully handle out-of-order delivery.
- **Response (200 OK):** `{ "received": true }` returned immediately after signature verification and job queueing.
