# MVP Scope Specification (V1 vs. Future Roadmap) — SERVORA

---

## 1. Scope Boundary Philosophy

The objective of **Servora V1 (MVP)** is to deliver an end-to-end, production-grade SaaS product that fulfills the core product promise: **"Turn enquiries into customers."**

To maintain laser focus, avoid budget burnout, and ship a robust system without unnecessary complexity, we establish a strict boundary between what is in scope for V1 and what is deferred to subsequent versions.

---

## 2. In-Scope Modules for V1 (MVP)

| Module | V1 MVP Functional Capabilities | Implementation Mechanism |
| :--- | :--- | :--- |
| **1. Authentication & Identity** | Email/Password and Google Social Sign-In for Business Owners and Staff. Session verification, password resets. | Clerk Integration |
| **2. Multi-Tenancy Engine** | Strict tenant isolation via `organizationId` scoping. Workspace switching, organization profile, branding configuration. | NestJS Tenant Context Interceptor + MongoDB Query Scoping |
| **3. Business Onboarding** | Step-by-step wizard: Organization setup, first service addition, operating hours configuration, public page publication. | Next.js Server Components + Form Validation |
| **4. Business Profile** | Business name, description, address, geo-coordinates, phone, email, operating hours, social links, public slug. | `organizations` collection |
| **5. Service Catalog** | Full CRUD for services: Category, base price, duration, cleanup buffer time, modifier options (e.g. vehicle sizes). | `services` collection |
| **6. Deterministic Pricing Engine** | Base price + modifier additions + add-ons - discounts + taxes. Returns itemized price quotes. | Deterministic TypeScript Calculation Module |
| **7. Staff Management** | Staff profiles, assigned services, weekly shift hours, break times, and contact details. | `staff` collection |
| **8. Availability Engine** | Real-time computation of bookable slots over a 14-day rolling window, respecting holidays and buffers. | Memory-efficient date-math slot generator |
| **9. Booking Engine** | Concurrency-protected slot reservation, booking state machine, cancellation/rescheduling validation. | Redis atomic lock (`SET NX EX`) + MongoDB transaction |
| **10. Customer CRM** | Centralized list of customers, contact details, total lifetime spend, visit count, service history, and notes. | `customers` collection |
| **11. Lead Capture & Pipeline** | Automated capture of unconverted AI chat inquiries, qualification tracking, status pipeline (`NEW` to `BOOKED`). | `leads` collection |
| **12. Public Business Website** | Dynamic public web page (`servora.app/[slug]`) with hero, service cards, gallery, hours, and booking modal. | Next.js dynamic routing (`app/[slug]/page.tsx`) |
| **13. AI Receptionist Widget** | Floating interactive web widget on public page. Answers FAQs, explains services, and guides the customer. | Custom React Chat Widget + Streaming API |
| **14. AI Tool Calling Engine** | Deterministic function-calling integration: `get_services`, `get_availability`, `calculate_quote`, `create_booking`. | OpenAI Tool Calling / Function Calling Schema |
| **15. Email Notifications** | Automated emails for booking confirmation, 24h reminders, cancellations, and new lead alerts to owners. | Resend API + BullMQ background queue |
| **16. Business Analytics Dashboard** | High-level metrics: Today's bookings, weekly revenue, new leads, conversion rate, popular services. | MongoDB Aggregation Pipelines + PostHog events |
| **17. Basic SaaS Billing Architecture** | Schema and tracking for Starter, Growth, and Pro tiers, trial period enforcement, and manual/Stripe test billing. | `subscriptions` collection |

---

## 3. Explicitly Out of Scope for V1 (Deferred to V2+)

The following capabilities are deliberately **excluded from V1** to ensure rapid, dependable execution and prevent architectural bloat:

```
❌ NO Native Mobile Apps (iOS / Android) — Web App is responsive across mobile browsers.
❌ NO WhatsApp Business API Integration — Deferred to V2.
❌ NO Instagram Direct Message Automation — Deferred to V3.
❌ NO Google Business Profile Direct Sync / Messaging — Deferred to V3.
❌ NO Voice AI Receptionist (Inbound phone calls) — Deferred to V3.
❌ NO White-Labeling / Custom Tenant CNAME Domains (e.g., booking.apexdetailing.com) — Deferred to V3/V4.
❌ NO Complex Multi-Provider AI Fallback Routing — OpenAI is primary; Gemini is architectural abstraction only for V1.
❌ NO In-App Payment Processing for Customers (Customer -> Business payment in V1 is Pay at Studio / Cash / Offline POS).
❌ NO Advanced Automated Multi-Step Marketing Drip Campaigns — Deferred to V2.
❌ NO Multi-Location Bay/Resource Allocations — V1 supports single-location businesses.
```

---

## 4. MVP Quality Gates & Acceptance Criteria

Before V1 can be considered feature-complete, it must pass the following qualitative criteria:

1. **Zero Booking Race Conditions:** Under simulated concurrent booking requests for the identical slot, exactly one reservation succeeds and the second gracefully receives a slot-unavailable warning.
2. **Deterministic AI Quotations:** The AI receptionist never quotes a figure that differs from `calculate_quote()` output by even 1 cent/rupee.
3. **Strict Data Boundary:** Automated tests verify that authenticated API requests from Organization A querying an Organization B `bookingId` or `customerId` unconditionally return HTTP 404/403.
4. **Development Budget Ceiling:** AI usage tracking must accurately record all tokens consumed during testing and stay within the $50 development budget.
