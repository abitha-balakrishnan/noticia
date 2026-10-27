# Noticia — UI Design, Backend Logic, API Calls, and Data Flow

## 1. Page-by-Page UI Design

### 1.1 Login / Register Page
**Layout:**
- Centered card (max-width ~400px) on a dark security-themed background.
- Fields: Email, Password.
- Button: **"Log In"** (primary, full-width, bottom of the form).
- Link below button: "Don't have an account? Register" toggles to a register form (Name, Email, Password, Confirm Password, role defaults to `analyst` — only an existing admin can promote someone to `admin`).
- On OTP-required login: a second screen appears with a 6-digit code input and a **"Verify"** button, plus a "Resend code" text link.

**What happens on click:**
- **"Log In" click** → `POST /api/auth/login` with `{email, password}` → backend validates credentials → if valid, triggers OTP email and returns a temporary token → frontend navigates to OTP screen.
- **"Verify" click** → `POST /api/auth/verify-otp` with `{tempToken, otp}` → backend confirms → returns final JWT → frontend stores JWT in memory (React Context, **not** localStorage per security best practice for this app) → redirects to `/dashboard`.

### 1.2 Main Dashboard Layout
**Structure (persistent across all authenticated pages):**
- **Left sidebar (fixed, ~220px wide):** Logo/title "Noticia", nav links: Dashboard (home icon), Alerts (bell icon), Chat Assistant (chat icon), Blocked IPs (shield icon, admin-only), Settings (gear icon, bottom of sidebar).
- **Top bar:** Search bar (optional, searches alerts by IP/username), user avatar + name + role badge (top right), **"Logout"** button (top right, next to avatar).
- **Main content area:** changes per page (see below).

**What happens on click:**
- Sidebar nav items → client-side route change via React Router (no full reload).
- **"Logout"** click → clears JWT from context/state, calls `POST /api/auth/logout` (invalidates refresh token server-side if used), redirects to `/login`.

### 1.3 Dashboard Home (Overview)
**Layout (grid):**
- Top row: 3 stat cards — "Total Logs Today", "Active Alerts", "Blocked IPs" (each a simple number + small icon).
- Middle row: Line chart — "Alerts Over Time" (last 24 hours, Recharts `LineChart`).
- Middle row (side by side with above): Pie chart — "Severity Distribution" (High/Medium/Low).
- Bottom section: **"Recent Alerts"** table (last 5 alerts), each row clickable → navigates to Alerts page filtered to that alert.

**What happens on click:**
- Page load → `GET /api/dashboard/summary` fetches all stat card values + chart data in a single call (to minimize round trips) → data fetched via `useEffect` on mount, stored in local state, rendered into cards/charts.
- Socket.IO listener (`useEffect` with socket subscription) updates stat cards and prepends to alert table live as `new_alert` events arrive — no manual refresh needed.
- Clicking a table row → `navigate('/alerts?alertId=xyz')`.

### 1.4 Alerts Page
**Layout:**
- Filter bar at top: dropdown for Severity (All/High/Medium/Low), date range picker, IP search input, **"Apply Filters"** button (placed at the right end of the filter bar).
- Below: a scrollable list of alert cards. Each card shows: severity color strip (left edge — red/orange/yellow), IP address, username, timestamp, anomaly score, and two buttons on the right side of the card: **"View Details"** and **"Suggest Action"**.

**What happens on click:**
- **"Apply Filters"** → `GET /api/alerts?severity=high&from=...&to=...&ip=...` → results replace the current list.
- **"View Details"** → opens a right-side slide-in panel showing the full raw log entry, related logs from the same IP (fetched via `GET /api/logs?ip=xyz&limit=20`), and a mini timeline.
- **"Suggest Action"** → opens a confirmation modal: *"Block IP 103.45.67.89? This will prevent future requests from this address."* with **"Confirm Block"** and **"Cancel"** buttons.
  - **"Confirm Block"** click (only visible/enabled for `admin` role — analysts see a disabled button with a tooltip "Admin approval required") → `POST /api/actions/block-ip` with `{ip, alertId}` → on success, alert card updates to show a "Blocked" tag, and the IP appears in the Blocked IPs page.
  - **"Cancel"** → closes modal, no API call.

### 1.5 Chat Assistant Page (Natural Language Query)
**Layout:**
- Full-height two-part layout: chat message history (scrollable, top ~85% of area) and a fixed input bar at the bottom.
- Each AI response bubble includes a small gray subtext below it: *"Source: 47 records matched"* — this is the transparency/grounding indicator.
- Input bar: text input (placeholder: "Ask about your security logs...") + **"Send"** button (right side of input bar) + a small **"New Chat"** button (top right of the page, clears the visible thread but history remains in DB for audit).
- Suggested-question chips above the input on first load (e.g., "Show today's failed logins", "Any suspicious IPs today?") — clicking a chip auto-fills and sends that question.

**What happens on click:**
- **"Send"** (or Enter key) → appends the user's message to the chat UI immediately (optimistic update) → `POST /api/chat/query` with `{question}` → shows a typing/loading indicator in the AI's message slot while waiting → on response, replaces the loading indicator with the actual answer + source count.
- Suggested question chip click → same flow as Send, using the chip's preset text.

### 1.6 Blocked IPs Page (Admin only)
**Layout:**
- Table: IP address, Blocked By (admin name), Blocked At (timestamp), and an **"Unblock"** button per row (right-most column).
- **What happens on click:** "Unblock" → confirmation modal → on confirm, `DELETE /api/actions/block-ip/:id` → row removed from table.

### 1.7 Settings Page
- Simple form: change password, (admin only) manage user roles — a table of all users with a role dropdown per row and a **"Save"** button per row that calls `PATCH /api/users/:id/role`.

---

## 2. Backend Logic — How Each Piece Works

### 2.1 Request Lifecycle (General Pattern)
1. Frontend sends request with `Authorization: Bearer <JWT>` header (Axios interceptor attaches this automatically to every call).
2. Express route hits `authMiddleware` first — decodes JWT, verifies signature and expiry, attaches `req.user = {id, role}`.
3. If the route requires a specific role (e.g., block-IP), `roleMiddleware('admin')` runs next — rejects with `403` if role doesn't match.
4. Controller function runs the actual business logic (query DB, call ML service, call LLM, etc.).
5. Response returned as JSON with a consistent shape: `{success: true/false, data: ..., message: ...}`.

### 2.2 Log Ingestion → Alert Logic (Data Flow)
```
[Log Simulator / Real Source]
        |
        v
POST /api/logs/ingest  --> validate (Zod) --> save to `logs` collection
        |
        v
[node-cron job runs every 10-15s]
        |
        v
Fetch unprocessed logs (flag: processed=false)
        |
        v
Extract features (failed-count per IP/min, freq, etc.)
        |
        v
POST http://ml-service/predict  (internal call)
        |
        v
Receive {anomaly_score, label} per log
        |
        v
If score > 0.7: create Alert document (severity computed from score band)
        |
        v
Mark logs as processed=true
        |
        v
io.emit('new_alert', alertData)  --> pushed to all connected dashboard clients instantly
```

### 2.3 Natural Language Query → RAG Logic (Data Flow)
```
[User types question in Chat UI]
        |
        v
POST /api/chat/query {question}
        |
        v
Backend builds LLM prompt #1: 
  "Given this schema: {Log fields}, convert the user question into a MongoDB filter JSON. 
   Only use these fields: [ip, username, status, timestamp]. Return JSON only."
        |
        v
Call Groq API --> receive raw JSON filter string
        |
        v
Parse JSON --> queryValidator.js checks:
  - all field names are in the allow-list
  - date ranges are valid and not absurd (e.g., not year 1900)
  - if invalid --> return "I couldn't understand that query, please rephrase" (no DB call made)
        |
        v
If valid --> run db.logs.find(validatedFilter) --> get real result array (could be empty)
        |
        v
Backend builds LLM prompt #2:
  "Here is the actual data retrieved: {results}. Summarize ONLY this data in plain English.
   If the array is empty, say no matching records were found. Do not add outside information."
        |
        v
Call Groq API --> receive grounded natural-language answer
        |
        v
Save {question, generatedQuery, resultCount, answer} to ChatHistory (audit trail)
        |
        v
Return {answer, resultCount} to frontend --> rendered in chat bubble with "Source: N records matched"
```

### 2.4 Action Approval Logic
```
[Admin clicks "Confirm Block" in modal]
        |
        v
POST /api/actions/block-ip {ip, alertId}
        |
        v
authMiddleware --> roleMiddleware('admin') --> reject if not admin
        |
        v
Insert into blocked_ips {ip, blockedBy: req.user.id, blockedAt: now}
        |
        v
Update related Alert status to "actioned"
        |
        v
Return success --> frontend updates alert card UI + Blocked IPs table
```

---

## 3. API Endpoint Reference (Complete List)

| Method | Endpoint | Auth Required | Role | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | No | — | Create new user account |
| POST | `/api/auth/login` | No | — | Validate credentials, trigger OTP |
| POST | `/api/auth/verify-otp` | No | — | Confirm OTP, issue JWT |
| POST | `/api/auth/logout` | Yes | Any | Invalidate session |
| GET | `/api/dashboard/summary` | Yes | Any | Stat cards + chart data |
| POST | `/api/logs/ingest` | Yes (service key) | — | Accept new log event |
| GET | `/api/logs` | Yes | Any | Fetch logs (filterable by ip/date) |
| GET | `/api/alerts` | Yes | Any | Fetch alerts (filterable) |
| GET | `/api/alerts/:id` | Yes | Any | Fetch single alert detail |
| POST | `/api/chat/query` | Yes | Any | Natural language query (RAG) |
| GET | `/api/chat/history` | Yes | Any | Fetch past chat sessions |
| POST | `/api/actions/block-ip` | Yes | Admin | Block an IP |
| DELETE | `/api/actions/block-ip/:id` | Yes | Admin | Unblock an IP |
| GET | `/api/actions/blocked-ips` | Yes | Any | List currently blocked IPs |
| PATCH | `/api/users/:id/role` | Yes | Admin | Change a user's role |

---

## 4. Database Management — How Data Is Fetched and Updated

- **Reads:** All list endpoints (`/api/logs`, `/api/alerts`) support pagination (`?page=1&limit=20`) and are backed by MongoDB indexes on `timestamp`, `ip`, and `severity` to keep queries fast as data grows.
- **Writes:** Log ingestion and alert creation are the two highest-frequency writes — both use MongoDB's native driver bulk-insert where possible (during simulation) to avoid write bottlenecks.
- **Vector Search (RAG semantic fallback):** For questions that don't map cleanly to a structured filter (e.g., "anything unusual today?"), log summaries are embedded and stored with MongoDB Atlas Vector Search; the query is embedded the same way and a similarity search retrieves the closest matching log summaries as the grounding data instead of a structured filter.
- **Data retention:** A scheduled job can archive/delete logs older than a configurable window (e.g., 30 days) to keep the free-tier cluster within storage limits — mention this in your report as a "future scalability consideration."

---

## 5. Component-to-API Mapping (Frontend Reference)

| React Component | API Call(s) | Trigger |
|---|---|---|
| `LoginForm` | `POST /api/auth/login`, `POST /api/auth/verify-otp` | Button click / Enter key |
| `DashboardHome` | `GET /api/dashboard/summary` | On mount + Socket.IO `new_alert` events |
| `AlertsList` | `GET /api/alerts` | On mount + filter button click |
| `AlertDetailPanel` | `GET /api/alerts/:id`, `GET /api/logs?ip=...` | On "View Details" click |
| `BlockIpModal` | `POST /api/actions/block-ip` | On "Confirm Block" click |
| `ChatPanel` | `POST /api/chat/query` | On "Send" click / Enter key / suggested chip click |
| `BlockedIpsTable` | `GET /api/actions/blocked-ips`, `DELETE /api/actions/block-ip/:id` | On mount / "Unblock" click |
| `UserRoleTable` (Settings) | `GET /api/users`, `PATCH /api/users/:id/role` | On mount / "Save" click per row |
