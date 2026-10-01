# Multi-Tenant Architecture & Data Isolation Strategy — SERVORA

---

## 1. Architectural Tenancy Model

Servora implements a **Logical Multi-Tenancy (Shared Database, Segregated Documents)** architecture. All tenants reside within a shared MongoDB Atlas cluster, but every piece of state, customer data, and operational telemetry is strictly bounded by a tenant identifier (`organizationId`).

```mermaid
graph TD
    subgraph Multi_Tenant_Ecosystem ["Servora Multi-Tenant Platform"]
        Gateway[API Gateway / NestJS Request Pipeline]
        AuthGuard[Tenant Context Interceptor / AsyncLocalStorage]
    end

    Gateway --> AuthGuard

    subgraph Org_A ["Tenant A: Apex Detailing Studio"]
        direction TB
        A_Services[Services A]
        A_Bookings[Bookings A]
        A_Customers[Customers A]
        A_AI[AI Receptionist A]
    end

    subgraph Org_B ["Tenant B: Elite Ceramic Lab"]
        direction TB
        B_Services[Services B]
        B_Bookings[Bookings B]
        B_Customers[Customers B]
        B_AI[AI Receptionist B]
    end

    AuthGuard -->|org_id = 'apex'| Org_A
    AuthGuard -->|org_id = 'elite'| Org_B

    subgraph Shared_Storage ["Shared MongoDB Atlas Cluster"]
        Collections[Collections: services, bookings, customers, leads, ai_usage]
        FilterRule[Mandatory Filter: { organizationId: currentTenantId }]
    end

    Org_A --> FilterRule
    Org_B --> FilterRule
    FilterRule --> Collections
```

---

## 2. Inviolable Tenancy Invariant

> **Strict Isolation Invariant:**  
> Under no circumstances can an actor authenticated within Organization A view, mutate, enumerate, or execute actions against resources belonging to Organization B. Any attempt results in an immediate authorization failure (`HTTP 403 Forbidden` or `HTTP 404 Not Found`), logged to the security audit trail.

Resources strictly isolated per organization:
- Customers & Contact Details
- Leads & Extracted Inquiries
- Bookings, Appointments & Schedule Holds
- Service Catalog & Custom Pricing Matrix
- Staff Members, Shifts & Availability Rules
- Conversations & AI Receptionist Transcripts
- Knowledge Base Documents & Vector Embeddings
- Transaction Records & SaaS Subscriptions
- AI Token Usage & Cost Ledgers

---

## 3. Multi-Layered Isolation Strategy

Tenant isolation in Servora is enforced across four defensive tiers:

```
[Tier 1: Ingress & URL Resolution] -> Resolve Slug or Header to OrganizationId
         │
[Tier 2: NestJS Tenant Middleware] -> Verify Membership & Populate AsyncLocalStorage Context
         │
[Tier 3: Controller & Service RBAC] -> Assert Role Permissions for Tenant Context
         │
[Tier 4: Repository / Data Access] -> Mandate { organizationId } on All Mongoose Queries
```

### 3.1 Tier 1: Ingress Resolution
Tenant context is resolved based on the entry point:
- **Public Customer Ingress:** The public page URL slug (`servora.app/[slug]` or `/api/v1/public/:slug/*`) is resolved against the `organizations` collection to retrieve `organizationId`. If the slug does not exist or the organization is `SUSPENDED`, requests are rejected at the edge.
- **Authenticated Dashboard Ingress:** In the business dashboard, the client sends an `x-organization-id` header with the active workspace ID.

### 3.2 Tier 2: Tenant Context & `AsyncLocalStorage`
NestJS injects tenant context using Node.js `AsyncLocalStorage`:
1. The `TenantInterceptor` extracts the user session from Clerk and retrieves the requested `organizationId`.
2. It queries `memberships` to verify that `userId` possesses an active membership in that `organizationId`.
3. If valid, the execution context (`organizationId`, `userId`, `role`) is stored in `AsyncLocalStorage`.
4. Downstream services and repositories access the active tenant without manually passing `organizationId` across every function parameter.

### 3.3 Tier 3: Service-Level RBAC Guards
All business-tier mutations evaluate whether the actor's role (`BUSINESS_OWNER`, `BUSINESS_ADMIN`, or `STAFF`) grants the appropriate permission within that specific tenant. Staff members are further restricted to viewing only their assigned bookings.

### 3.4 Tier 4: Repository-Level Automated Query Scoping
To eliminate developer error (e.g., forgetting a `where: { organizationId }` clause):
- A custom Mongoose repository wrapper or pre-find/pre-save middleware automatically appends `{ organizationId: currentTenantId }` to every `find`, `findOne`, `updateOne`, `delete`, and `aggregate` operation on tenant-owned collections.
- Any query attempting to specify a different `organizationId` than the context throws an unhandled `TenantViolationException`.

---

## 4. Multi-Tenant Key Scoping in Redis Cache

Because Redis is a shared key-value store, all cache keys, rate-limit buckets, and distributed locks use a mandatory tenant-prefixed naming convention:

| Purpose | Redis Key Format | TTL |
| :--- | :--- | :--- |
| **Slot Booking Lock** | `lock:org:<organizationId>:slot:<date>:<time>` | 15 seconds (Atomic) |
| **Service Catalog Cache** | `cache:org:<organizationId>:services` | 300 seconds |
| **Tenant Rate Limit** | `ratelimit:org:<organizationId>:ai:<minute_bucket>` | 60 seconds |
| **Visitor Session** | `session:org:<organizationId>:visitor:<visitorId>` | 24 hours |

---

## 5. Vector Search Tenancy (RAG Isolation)

MongoDB Atlas Vector Search supports pre-filtering vector queries using metadata:
- Every vector document in `knowledge_base` stores `organizationId: ObjectId`.
- When querying embeddings during customer conversations, the `$vectorSearch` pipeline stage enforces a strict exact-match filter on `organizationId`:

```json
{
  "$vectorSearch": {
    "index": "vector_index_knowledge",
    "path": "embedding",
    "queryVector": [0.012, -0.045, ...],
    "numCandidates": 50,
    "limit": 5,
    "filter": {
      "organizationId": { "$eq": "CURRENT_TENANT_ID" }
    }
  }
}
```

This guarantees that Customer A chatting with Business A will never retrieve knowledge base chunks belonging to Business B, even if the cosine similarity of the content is identical.
