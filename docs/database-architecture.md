# Database Architecture & Data Models — SERVORA

---

## 1. Datastore Overview & Design Principles

Servora utilizes **MongoDB Atlas** as its primary document datastore, accessed via **Mongoose**. MongoDB provides native support for dynamic, nested service modifier schemas, time-slot arrays, conversational transcripts, and Atlas Vector Search indexing without requiring multiple disparate databases.

### Core Data Modeling Principles:
1. **Strict Multi-Tenancy:** Every tenant-owned document must include an indexed `organizationId: ObjectId`.
2. **ACID Transaction Boundary:** Critical state changes (e.g., booking confirmation + customer update + slot reservation) execute within explicit MongoDB sessions (`session.withTransaction()`).
3. **Immutability of Financial & Audit Trails:** Payment records, audit logs, and AI usage metrics are append-only.

---

## 2. Global vs. Tenant-Owned Entity Classification

| Entity Classification | Collections | Description |
| :--- | :--- | :--- |
| **GLOBAL ENTITIES** | `users`, `audit_logs` (platform-level) | Persist cross-organization user accounts, authentication linkages, and global platform audit logs. |
| **TENANT-OWNED ENTITIES** | `organizations`, `memberships`, `services`, `staff`, `availability`, `customers`, `leads`, `bookings`, `conversations`, `messages`, `knowledge_base`, `notifications`, `subscriptions`, `payments`, `ai_usage`, `integrations` | Scoped strictly to an `organizationId`. Query operations must mandate this filter. |

---

## 3. High-Read vs. High-Write & Data Retention Categorization

| Category | Collections | Performance & Retention Strategy |
| :--- | :--- | :--- |
| **High-Read Entities** | `services`, `availability`, `organizations`, `knowledge_base` | Read-heavy from public landing pages and AI tool checks. Covered indexes; in-memory/Redis TTL caching (5-minute invalidation). |
| **High-Write Entities** | `messages`, `ai_usage`, `audit_logs`, `notifications` | Write-heavy during active customer sessions. Asynchronous batching or append-only write streams. |
| **Sensitive Data** | `payments` (customer payment tokens), `customers` (PII: phone/email), `integrations` (API keys, webhooks) | Field-level encryption at rest, masked in logs, restricted by RBAC. |
| **Retention Policies** | `messages`, `ai_usage`, `audit_logs` | TTL index on ephemeral sessions (e.g. anonymous visitor chats archived after 90 days; AI usage aggregated into monthly rollups). |

---

## 4. Comprehensive Collection Specifications

### 4.1 `organizations`
- **Ownership:** Tenant Root (Each organization is a tenant).
- **Purpose:** Represents a business workspace, public profile, and regional settings.
- **Important Fields:**
  - `_id`: ObjectId
  - `name`: String (e.g., "Apex Detailing Studio")
  - `slug`: String (Unique index, e.g., "apex-detailing")
  - `timezone`: String (e.g., "Asia/Kolkata", "America/New_York")
  - `currency`: String (ISO 4217, e.g., "INR", "USD")
  - `contact`: `{ phone: String, email: String, address: String, coordinates: [Number] }`
  - `branding`: `{ logoUrl: String, primaryColor: String, coverImageUrl: String }`
  - `settings`: `{ bookingBufferMinutes: Number, maxAdvanceBookingDays: Number, autoConfirmBookings: Boolean }`
  - `status`: String (`'ACTIVE'`, `'SUSPENDED'`, `'PENDING_ONBOARDING'`)
  - `createdAt`, `updatedAt`: Timestamps
- **Indexes:** `{ slug: 1 }` (Unique), `{ status: 1 }`
- **Constraints:** `slug` must be URL-safe lowercase alphanumeric with hyphens.

### 4.2 `users`
- **Ownership:** Global.
- **Purpose:** Centralized user identity linked to Clerk.
- **Important Fields:**
  - `_id`: ObjectId
  - `clerkId`: String (Unique external ID)
  - `email`: String (Unique lowercase)
  - `firstName`, `lastName`: String
  - `phone`: String
  - `avatarUrl`: String
  - `globalRole`: String (`'PLATFORM_ADMIN'`, `'USER'`)
- **Indexes:** `{ clerkId: 1 }` (Unique), `{ email: 1 }` (Unique)

### 4.3 `memberships`
- **Ownership:** Tenant-Owned.
- **Purpose:** Represents the direct relationship between **User ↔ Organization**, granting a user access to a specific tenant workspace with scoped RBAC permissions while maintaining strict tenant isolation.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId (Ref: `organizations`, tenant anchor)
  - `userId`: ObjectId (Ref: `users`, global user identity)
  - `role`: String (`'BUSINESS_OWNER'`, `'BUSINESS_ADMIN'`, `'STAFF'`)
  - `status`: String (`'INVITED'`, `'ACTIVE'`, `'REVOKED'`)
  - `createdAt`: Date (Timestamp when membership was established)
  - `updatedAt`: Date (Timestamp of last role/status mutation)
- **Indexes:** `{ organizationId: 1, userId: 1 }` (Compound Unique), `{ userId: 1 }`
- **Tenant Isolation Invariant:** A user can have memberships across multiple organizations, but queries within an active tenant session are strictly isolated to the matching `organizationId`.

### 4.4 `services`
- **Ownership:** Tenant-Owned.
- **Purpose:** Service catalog items available for booking and AI quotation.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `name`: String (e.g., "Ceramic Coating (3-Year)")
  - `slug`: String
  - `category`: String (e.g., "Coating", "Wash", "Detailing")
  - `description`: String
  - `basePrice`: Number (Integer in smallest currency unit or decimal, e.g., 18000)
  - `pricingModel`: String (`'FIXED'`, `'STARTING_AT'`, `'CUSTOM_QUOTE'`)
  - `baseDurationMinutes`: Number (e.g., 240)
  - `bufferAfterMinutes`: Number (e.g., 30)
  - `modifiers`: Array of:
    - `id`: String
    - `name`: String (e.g., "Vehicle Type")
    - `options`: Array of `{ label: String, priceAdjustment: Number, durationAdjustment: Number }`
  - `isActive`: Boolean
- **Indexes:** `{ organizationId: 1, isActive: 1 }`, `{ organizationId: 1, slug: 1 }`

### 4.5 `staff`
- **Ownership:** Tenant-Owned.
- **Purpose:** Service staff, technicians, and their eligible service capabilities.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `userId`: ObjectId (Optional link to registered user)
  - `fullName`: String
  - `email`: String
  - `phone`: String
  - `assignedServiceIds`: Array of ObjectId (Ref: `services`)
  - `isActive`: Boolean
- **Indexes:** `{ organizationId: 1, isActive: 1 }`

### 4.6 `availability`
- **Ownership:** Tenant-Owned.
- **Purpose:** Operating schedules, working shifts, and blackout dates.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `staffId`: ObjectId (Null if business-wide operating hours)
  - `type`: String (`'OPERATING_HOURS'`, `'STAFF_SHIFT'`, `'HOLIDAY_BLACKOUT'`)
  - `weeklySchedule`: Array of `{ dayOfWeek: Number (0-6), openTime: String ("09:00"), closeTime: String ("19:00"), breaks: [{ start: String, end: String }] }`
  - `specificDates`: Array of `{ date: String ("YYYY-MM-DD"), isAvailable: Boolean, hours: [...] }`
- **Indexes:** `{ organizationId: 1, staffId: 1, type: 1 }`

### 4.7 `customers`
- **Ownership:** Tenant-Owned.
- **Purpose:** CRM customer profiles for a given business organization.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `name`: String
  - `phone`: String (E.164 normalized, e.g., "+919876543210")
  - `email`: String (Lowercase)
  - `customAttributes`: Map / Object (e.g., `{ vehicleModel: "BMW X5", licensePlate: "MH02AB1234" }`)
  - `stats`: `{ totalBookings: Number, totalSpend: Number, cancellations: Number, noShows: Number }`
  - `notes`: Array of `{ text: String, authorId: ObjectId, createdAt: Date }`
- **Indexes:** `{ organizationId: 1, phone: 1 }`, `{ organizationId: 1, email: 1 }`
- **Sensitive Fields:** `phone`, `email` (PII).

### 4.8 `leads`
- **Ownership:** Tenant-Owned.
- **Purpose:** Captures prospective customers who engaged in inquiry but haven't booked.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `source`: String (`'AI_RECEPTIONIST'`, `'MANUAL'`, `'WEBSITE_FORM'`)
  - `customerInfo`: `{ name: String, phone: String, email: String }`
  - `status`: String (`'NEW'`, `'CONTACTED'`, `'QUALIFIED'`, `'QUOTED'`, `'BOOKED'`, `'LOST'`)
  - `interestedServiceId`: ObjectId (Ref: `services`)
  - `estimatedBudget`: Number
  - `extractedIntent`: String (e.g., "Looking for ceramic coating on new BMW X5, prefers weekend")
  - `conversationId`: ObjectId (Ref: `conversations`)
  - `bookingId`: ObjectId (Ref: `bookings`, if converted)
  - `assignedStaffId`: ObjectId
- **Indexes:** `{ organizationId: 1, status: 1 }`, `{ organizationId: 1, createdAt: -1 }`

### 4.9 `bookings`
- **Ownership:** Tenant-Owned.
- **Purpose:** Confirmed, pending, and historical appointment records.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `bookingReference`: String (Unique human-friendly code, e.g., "BK-78912")
  - `customerId`: ObjectId (Ref: `customers`)
  - `serviceId`: ObjectId (Ref: `services`)
  - `staffId`: ObjectId (Ref: `staff`)
  - `startTime`: Date (UTC)
  - `endTime`: Date (UTC)
  - `status`: String (`'PENDING'`, `'CONFIRMED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CANCELLED'`, `'NO_SHOW'`)
  - `pricing`: `{ basePrice: Number, modifierTotal: Number, discountTotal: Number, taxTotal: Number, finalTotal: Number, currency: String }`
  - `appliedModifiers`: Array of `{ modifierId: String, optionLabel: String, priceAdjustment: Number }`
  - `notes`: String
  - `rescheduleCount`: Number (Default: 0)
  - `cancellationReason`: String
- **Indexes:** `{ organizationId: 1, startTime: 1, endTime: 1 }`, `{ organizationId: 1, staffId: 1, startTime: 1 }`, `{ bookingReference: 1 }` (Unique)

### 4.10 `conversations` & `messages`
- **Ownership:** Tenant-Owned.
- **Purpose:** Stores customer dialogues with the AI receptionist.
- **`conversations` Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `channel`: String (`'WEB_CHAT'`)
  - `visitorId`: String (Anonymous cookie ID or CustomerId)
  - `customerId`: ObjectId (Optional link)
  - `status`: String (`'ACTIVE'`, `'CLOSED'`, `'CONVERTED'`)
  - `summary`: String
- **`messages` Fields:**
  - `_id`: ObjectId
  - `conversationId`: ObjectId (Ref: `conversations`)
  - `organizationId`: ObjectId
  - `sender`: String (`'CUSTOMER'`, `'AI_RECEPTIONIST'`, `'STAFF_OVERRIDE'`)
  - `content`: String
  - `toolCalls`: Array of `{ toolName: String, input: Object, output: Object }`
  - `createdAt`: Date
- **Indexes:** `{ organizationId: 1, conversationId: 1, createdAt: 1 }`

### 4.11 `knowledge_base`
- **Ownership:** Tenant-Owned.
- **Purpose:** Stores business knowledge, FAQs, and vector embeddings for RAG.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `title`: String
  - `category`: String (`'FAQ'`, `'POLICY'`, `'FACILITY'`, `'GENERAL'`)
  - `content`: String
  - `embedding`: Array of Number (1536 dimensions for `text-embedding-3-small`)
  - `isActive`: Boolean
- **Indexes:** MongoDB Atlas Vector Search Index on `embedding` with filter on `organizationId`.

### 4.12 `notifications`
- **Ownership:** Tenant-Owned.
- **Purpose:** Log of transactional dispatches (emails, SMS).
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `recipient`: String (Email / Phone)
  - `type`: String (`'BOOKING_CONFIRMATION'`, `'REMINDER_24H'`, `'LEAD_ALERT'`)
  - `channel`: String (`'EMAIL'`)
  - `status`: String (`'QUEUED'`, `'SENT'`, `'FAILED'`)
  - `externalMessageId`: String
- **Indexes:** `{ organizationId: 1, status: 1 }`

### 4.13 `subscriptions` & `payments`
- **Ownership:** Tenant-Owned (Servora SaaS Billing).
- **Purpose:** Tracks tenant subscription tier (`STARTER`, `GROWTH`, `PRO`), billing status, and platform fees.
- **`subscriptions` Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId (Unique)
  - `planId`: String (`'starter'`, `'growth'`, `'pro'`)
  - `status`: String (`'TRIALING'`, `'ACTIVE'`, `'PAST_DUE'`, `'CANCELED'`)
  - `currentPeriodStart`: Date
  - `currentPeriodEnd`: Date
  - `stripeCustomerId` / `razorpaySubscriptionId`: String
- **`payments` Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `amount`: Number
  - `currency`: String
  - `provider`: String (`'STRIPE'`, `'RAZORPAY'`)
  - `status`: String (`'SUCCESS'`, `'FAILED'`, `'PENDING'`)
- **Indexes:** `{ organizationId: 1 }`

### 4.14 `ai_usage`
- **Ownership:** Tenant-Owned (Monitored Globally).
- **Purpose:** Strict cost and token consumption audit ledger.
- **Important Fields:**
  - `_id`: ObjectId
  - `organizationId`: ObjectId
  - `conversationId`: ObjectId
  - `provider`: String (`'OPENAI'`, `'GEMINI'`)
  - `model`: String (Configured via `AI_DEFAULT_MODEL` / `AI_BALANCED_MODEL` / `AI_COMPLEX_MODEL`, e.g., `'GPT-5.6 Luna'`)
  - `requestType`: String (`'CHAT'`, `'EMBEDDING'`, `'TOOL_CALL'`)
  - `promptTokens`: Number
  - `completionTokens`: Number
  - `totalTokens`: Number
  - `estimatedCostUsd`: Number
  - `durationMs`: Number
  - `createdAt`: Date
- **Indexes:** `{ organizationId: 1, createdAt: -1 }`, `{ createdAt: -1 }` (Global Admin Rollups)

### 4.15 `audit_logs` & `integrations`
- **`audit_logs`:** Append-only log of security, administrative, and data mutation events (`actorId`, `organizationId`, `action`, `resource`, `ipAddress`, `timestamp`).
- **`integrations`:** OAuth tokens, webhooks, and third-party configuration (encrypted at rest).
