# SERVORA — Architecture & Product Documentation

> **Tagline:** _"Turn enquiries into customers."_

Welcome to the **SERVORA** core architectural and product documentation repository. This directory houses the comprehensive Phase 0 technical specifications, domain models, workflows, API contracts, security standards, and system architecture blueprints.

---

## 📚 Document Index

| Document                                                                                                         | Purpose / Content Summary                                                                            |
| :--------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| [product-vision.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/product-vision.md)                   | Product vision, positioning, value proposition, initial vertical, and core business philosophy.      |
| [product-requirements.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/product-requirements.md)       | Detailed functional and non-functional requirements across all product modules.                      |
| [user-personas.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/user-personas.md)                     | Roles and personas: Platform Admin, Business Owner, Business Admin, Staff, and Customer.             |
| [user-flows.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/user-flows.md)                           | Core journeys (Onboarding, Customer AI receptionist chat, Booking, Rescheduling, Follow-up).         |
| [mvp-scope.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/mvp-scope.md)                             | Strict boundaries for V1 MVP vs future phased expansions.                                            |
| [system-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/system-architecture.md)         | Monorepo structure, high-level component diagrams, data flow, and runtime topology.                  |
| [database-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/database-architecture.md)     | MongoDB Atlas schema specifications, indexes, constraints, sensitivity, and retention.               |
| [multi-tenancy.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/multi-tenancy.md)                     | Tenant isolation strategy, middleware context injection, data segregation, and security enforcement. |
| [ai-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/ai-architecture.md)                 | AI provider abstraction (OpenAI/Gemini), prompt engineering, token cost control, and RAG.            |
| [ai-tools.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/ai-tools.md)                               | Specifications for all deterministic AI function-calling tools with permissions and schemas.         |
| [booking-engine.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/booking-engine.md)                   | Availability calculation, conflict prevention, atomic locking, and the booking state machine.        |
| [pricing-engine.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/pricing-engine.md)                   | Deterministic pricing calculator: base rates, vehicle/tier modifiers, taxes, and quote validation.   |
| [api-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/api-architecture.md)               | REST API grouping, endpoint specifications, idempotency, rate limiting, and status codes.            |
| [security-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/security-architecture.md)     | Auth (Clerk), RBAC matrix, prompt injection defense, webhook verification, and audit logs.           |
| [billing-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/billing-architecture.md)       | Separation of Flow A (Customer → Business) and Flow B (Business → Servora SaaS subscriptions).       |
| [analytics-plan.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/analytics-plan.md)                   | Business metrics, platform product analytics (PostHog), and AI token/cost telemetry.                 |
| [observability.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/observability.md)                     | Structured logging, Sentry error tracking, request tracing, latency monitoring, and alerts.          |
| [deployment-architecture.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/deployment-architecture.md) | Vercel (Next.js), Railway (NestJS + BullMQ), Atlas, Upstash Redis, and Cloudflare setup.             |
| [testing-strategy.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/testing-strategy.md)               | Vitest unit/integration testing, Playwright E2E suites, and critical test matrices.                  |
| [future-roadmap.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/future-roadmap.md)                   | Phased roadmap: V1 MVP, V2 Communications & Integrations, V3 Omnichannel, V4 Scale.                  |
| [phase-0-completion.md](file:///Users/prashamjain/Desktop/PROJECTS/SERVORA/docs/phase-0-completion.md)           | Phase 0 verification sign-off, risk matrix, architectural decisions, and Phase 1 readiness.          |

---

## 📌 Guiding Architectural Principles

1. **Deterministic Business Logic is the Source of Truth:**
   AI is strictly an interactive receptionist and natural language interface. AI never calculates quotes out of thin air, checks availability by hallucinating calendars, or confirms bookings without transactional execution through verified backend tools.
2. **Strict Multi-Tenant Isolation:**
   Tenant data leakage is catastrophic. Every read, write, query, and cache key is scoped by an `organizationId`, verified at the gateway and repository layers.
3. **Budget-Conscious AI Engineering:**
   Every LLM invocation is metered, cached where applicable, tracked with token counts and latency metrics, and routed to optimal models to conserve operational budgets.
4. **Pragmatic Simplicity (Modular Monolith):**
   Avoid premature microservices, Kubernetes clusters, or distributed event buses. A robust NestJS backend with BullMQ workers and MongoDB Atlas provides production-grade resilience with minimal DevOps overhead.
