# Analytics & Business Intelligence Plan — SERVORA

---

## 1. Analytics Architecture Taxonomy

Servora captures analytics across three distinct operational layers:

```
[1. Business Analytics]  --> Value delivered to Business Owners (Revenue, Bookings, Conversion)
[2. Product Analytics]   --> Platform growth & SaaS user funnels (PostHog telemetry)
[3. AI Performance Data] --> Cost accounting, token usage, tool efficacy, and model latency
```

---

## 2. Business Analytics (Tenant Dashboard Metrics)

These metrics are calculated via MongoDB aggregation pipelines and cached in Redis with a 5-minute TTL to ensure fast dashboard rendering:

| Metric | Formula / Aggregation Source | Purpose |
| :--- | :--- | :--- |
| **Total Revenue** | $\sum \text{bookings.pricing.finalTotal}$ where status = `'COMPLETED'` | Track financial volume of completed work. |
| **Booking Volume** | Count of bookings grouped by day/week/month | Capacity utilization and trend analysis. |
| **Lead-to-Booking Conversion** | $\frac{\text{Count of Leads with status = 'BOOKED'}}{\text{Total Leads Captured}} \times 100$ | Measure effectiveness of AI capture and sales follow-up. |
| **Cancellation & No-Show Rate** | $\frac{\text{Cancelled} + \text{No-Shows}}{\text{Total Scheduled Bookings}} \times 100$ | Identify schedule volatility or customer friction. |
| **Service Popularity Breakdown** | Bookings and revenue grouped by `serviceId` | Identify highest-margin and highest-demand services. |
| **Customer Retention Rate** | Customers with $\ge 2$ bookings / Total unique customers | Assess customer loyalty and repeat business. |

---

## 3. Product Analytics & Growth Funnels (PostHog)

Servora instruments user lifecycle events using **PostHog** to optimize conversion funnels and product onboarding:

```mermaid
funnel
    title Servora SaaS Onboarding Funnel
    "User Visits Landing Page" : 1000
    "Starts Clerk Sign Up" : 250
    "Creates Organization Workspace" : 200
    "Adds First Service" : 170
    "Sets Operating Hours" : 155
    "Publishes Public Page" : 140
    "Receives First AI Booking" : 85
    "Upgrades to Paid Plan" : 35
```

### Key Tracked PostHog Events:
- `user_signed_up`: Identifies new owner identity.
- `workspace_created`: Organization slug and initial setup parameters.
- `service_created`: Service catalog initialization.
- `page_published`: Public landing page activated.
- `ai_conversation_started`: Public visitor engages with AI widget.
- `ai_booking_completed`: Autonomous booking without human intervention.
- `subscription_started`: Free trial converted to paid SaaS tier.

---

## 4. AI Telemetry & Cost Accounting

To prevent runaway OpenAI costs and monitor receptionist accuracy, the system logs detailed operational metrics in the `ai_usage` collection:

| Telemetry Field | Tracking Objective | Action Threshold |
| :--- | :--- | :--- |
| **Input & Output Tokens** | Track prompt/response sizes per conversation | Trigger alert if single turn exceeds 1,200 tokens |
| **Estimated Cost ($ USD)** | Calculated per model token pricing | Daily spend threshold alerts ($5/day alert) |
| **Model Latency (ms)** | Time-to-first-token (TTFT) and total generation time | Alert if TTFT > 3.0 seconds |
| **Tool Execution Ratio** | Number of tool calls per 10 customer turns | Flag if conversations enter tool execution loops |
| **Fallback Rate** | Frequency of fallbacks from Tier 1 to Tier 2 model | Monitor model quality degradation |
