# User Flows & System Journeys — SERVORA

---

## 1. Flow 1: Business Registration & Workspace Onboarding

The business onboarding workflow transforms a newly signed-up user into a fully functional, published service organization in under 10 minutes.

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Business Owner
    participant Web as Next.js Web App
    participant API as NestJS Gateway
    participant DB as MongoDB Atlas
    participant Clerk as Clerk Auth

    Owner->>Web: Clicks "Start Free Trial"
    Web->>Clerk: Initiates Sign-Up (Email/Password or Google)
    Clerk-->>Web: Session JWT + User Identity Created
    Web->>API: POST /api/v1/auth/sync (Sync Clerk User)
    API->>DB: Upsert User Document
    Web->>Owner: Renders "Create Workspace" Wizard
    Owner->>Web: Enters Business Name ("Apex Detailing"), Slug ("apex-detailing"), Timezone ("Asia/Kolkata")
    Web->>API: POST /api/v1/organizations (Create Organization)
    API->>DB: Check Slug Uniqueness & Insert Organization
    API->>DB: Create Membership (userId, organizationId, role='BUSINESS_OWNER')
    Web->>Owner: Step 2: Add First Service (Name, Duration, Base Price, Modifiers)
    Owner->>Web: Submits Service Details
    Web->>API: POST /api/v1/services
    API->>DB: Insert Service Document
    Web->>Owner: Step 3: Define Business Operating Hours (Mon-Sat 09:00 - 19:00)
    Owner->>Web: Saves Operating Hours
    Web->>API: PUT /api/v1/availability/operating-hours
    API->>DB: Upsert Availability Config
    Web->>Owner: Step 4: Publish Profile
    Owner->>Web: Clicks "Publish Live Page"
    Web->>API: PATCH /api/v1/organizations/publish
    API->>DB: Set status = 'ACTIVE', published = true
    API-->>Web: Organization Live: servora.app/apex-detailing
```

---

## 2. Flow 2: Inbound Customer Journey & AI Receptionist Interaction

This flow illustrates how an unassisted customer interacts with the AI receptionist, receives a deterministic quote, and is qualified into the system.

```mermaid
sequenceDiagram
    autonumber
    actor Cust as End Customer
    participant Page as Public Web Page (Next.js)
    participant AI as AI Gateway & Receptionist
    participant Tools as Tool Execution Service
    participant Price as Pricing Engine
    participant DB as MongoDB Atlas

    Cust->>Page: Lands on servora.app/apex-detailing
    Page->>Cust: Displays Hero, Services & AI Receptionist Chat Widget
    Cust->>Page: Types: "Hi, how much for full ceramic coating for a 2024 BMW X5?"
    Page->>AI: POST /api/v1/ai/chat (Message + ConversationId + OrgId)
    AI->>AI: Extracts Intent: Service="Ceramic Coating", Vehicle="BMW X5" (Class: Mid/Large SUV)
    AI->>Tools: Invokes Tool: calculate_quote(service="ceramic_coating", modifier="large_suv")
    Tools->>Price: Compute deterministic price
    Price->>DB: Fetch Base Service & Modifier Surcharges
    Price-->>Tools: Quote: Base ₹18,000 + SUV Surcharge ₹5,000 = ₹23,000 (Tax incl: ₹27,140)
    Tools-->>AI: Deterministic Quote Result
    AI->>Page: Streams Answer: "For your BMW X5, our Full Ceramic Coating package is ₹27,140 all-inclusive. It includes 3-stage prep, 9H ceramic coating (3-year warranty), and glass treatment. Would you like to check available slots for this week?"
    Cust->>Page: "Yes, what do you have on Saturday?"
    Page->>AI: POST /api/v1/ai/chat ("Saturday availability")
    AI->>Tools: Invokes Tool: get_availability(date="2026-10-03", service="ceramic_coating")
    Tools->>DB: Query Working Hours, Existing Bookings, Buffer Windows
    Tools-->>AI: Open Slots: 10:00 AM, 02:30 PM
    AI-->>Page: "We have two slots open this Saturday, Oct 3: 10:00 AM and 2:30 PM. Which one works best for you?"
```

---

## 3. Flow 3: Atomic Slot Locking & Booking Execution

This workflow shows the strict concurrency-protected booking sequence.

```mermaid
sequenceDiagram
    autonumber
    actor Cust as End Customer
    participant Web as Public Web / AI Widget
    participant API as Booking Controller
    participant Redis as Redis Lock Engine
    participant BookEngine as Booking Engine
    participant DB as MongoDB Atlas
    participant Queue as BullMQ (Worker)
    participant Email as Resend Email Service

    Cust->>Web: Selects 10:00 AM Saturday & Enters Name, Phone ("+91 98765 43210"), Email
    Web->>API: POST /api/v1/bookings/reserve (orgId, serviceId, staffId, startTime, customerInfo)
    API->>Redis: SET lock:booking:apex-detailing:2026-10-03:10-00 NX EX 15
    alt Lock Acquisition Failed (Slot Already Contended)
        Redis-->>API: Lock Failed (Null)
        API-->>Web: HTTP 409 Conflict ("This slot was just claimed. Please select another time.")
    else Lock Acquired Successfully
        Redis-->>API: Lock OK
        API->>BookEngine: Verify Slot Validity & Conflict-Free State
        BookEngine->>DB: Fetch conflicting bookings for staff & time window
        alt Slot Already Booked in Database
            API->>Redis: DEL lock:...
            API-->>Web: HTTP 409 Conflict ("Slot unavailable")
        else Slot Confirmed Clear
            API->>DB: Upsert Customer Profile (Phone/Email match)
            API->>DB: Insert Booking Record (Status: 'CONFIRMED', BookingRef: 'BK-8942')
            API->>Redis: DEL lock:...
            API->>Queue: Enqueue 'send_booking_confirmation' job
            API-->>Web: HTTP 201 Created (Booking Details + Confirmation Screen)
            Web-->>Cust: Displays "Booking Confirmed! Reference #BK-8942"
            Queue->>Email: Send Customer & Business Confirmation Emails
        end
    end
```

---

## 4. Flow 4: Incomplete Inquiry to Lead Transition

When a customer expresses interest and provides contact information but abandons the checkout flow before finalizing, the system converts the conversation into a high-value qualified lead.

```mermaid
flowchart TD
    A[Customer chats with AI Receptionist] --> B[AI extracts Customer Name & Phone Number]
    B --> C[AI executes create_lead tool call]
    C --> D[(MongoDB leads Collection)]
    D --> E{Did customer complete booking?}
    E -- Yes --> F[Update Lead status = 'BOOKED' & link bookingId]
    E -- No (Session Idles / Drops) --> G[Lead status remains 'QUALIFIED']
    G --> H[BullMQ triggers 1-Hour Incomplete Lead Alert]
    H --> I[Email Notification dispatched to Business Admin]
    I --> J[Business Admin views Lead in Servora CRM Dashboard]
    J --> K[Business Admin initiates manual phone/WhatsApp follow-up]
```

---

## 5. Flow 5: Rescheduling & Cancellation Journey

```mermaid
sequenceDiagram
    autonumber
    actor Cust as End Customer / Admin
    participant Web as Web Portal
    participant API as Booking Controller
    participant Engine as Booking Engine
    participant DB as MongoDB Atlas
    participant Queue as BullMQ

    Cust->>Web: Submits Reschedule Request (Booking ID + New Desired Slot)
    Web->>API: PATCH /api/v1/bookings/:id/reschedule
    API->>DB: Find Booking by ID and OrganizationId
    API->>Engine: Validate Business Cancellation/Reschedule Policy
    alt Within Cutoff Window (e.g., < 4 hours before service)
        Engine-->>API: Rejection ("Rescheduling window closed per policy")
        API-->>Web: HTTP 400 Bad Request (Policy Violation Details)
    else Policy Allowed
        API->>Engine: Check new slot availability
        Engine-->>API: Slot is free
        API->>DB: Update Booking record (startTime, endTime, rescheduleCount++, status='CONFIRMED')
        API->>DB: Log Audit Event ('BOOKING_RESCHEDULED')
        API->>Queue: Enqueue Reschedule Notification Emails
        API-->>Web: HTTP 200 OK (Updated Booking Details)
    end
```
