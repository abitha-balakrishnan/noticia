# Noticia — Tech Stack and Full Implementation Plan

## 1. Complete Tech Stack

### 1.1 Frontend
- **Framework:** React 18 (with Vite as the build tool for fast dev/hot-reload)
- **Styling:** Tailwind CSS
- **Charts / Data Viz:** Recharts (for alert trend graphs, severity distribution charts)
- **State Management:** React Context API + useState/useReducer (no need for Redux at this scale)
- **HTTP Client:** Axios
- **Real-time updates:** Socket.IO client (for live alert push) OR polling every 5–10 seconds as a simpler fallback
- **Routing:** React Router v6

### 1.2 Backend (Core API Layer)
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Real-time layer:** Socket.IO server (pushes new alerts to connected dashboards instantly)
- **Validation:** Zod or Joi (validate all incoming requests and LLM-generated queries before execution)
- **Auth:** JSON Web Tokens (JWT) + bcrypt for password hashing
- **Email/OTP:** Nodemailer (for 2FA one-time passcodes)

### 1.3 Database
- **Primary DB:** MongoDB Atlas (cloud-hosted, free-tier M0 cluster)
- **Collections:**
  - `users` — analyst/admin accounts, hashed passwords, roles
  - `logs` — raw ingested security events
  - `alerts` — flagged suspicious events with severity score
  - `blocked_ips` — IPs approved for blocking by an admin
  - `chat_history` — natural language queries and their grounded answers (for audit trail)
- **Vector Search:** MongoDB Atlas Vector Search (used for the RAG layer — storing embeddings of log summaries for semantic retrieval when exact filters aren't enough)

### 1.4 Machine Learning Microservice
- **Language:** Python 3.10+
- **Framework:** FastAPI (lightweight, async, auto-generates OpenAPI docs)
- **ML Library:** Scikit-learn (Random Forest Classifier as the primary anomaly detector; can extend to XGBoost later)
- **Training data:** NSL-KDD or a sampled subset of CICIDS2017
- **Model serialization:** joblib / pickle (`trained_model.pkl`)
- **Exposed endpoint:** `POST /predict` — accepts a batch of log feature vectors, returns anomaly scores

### 1.5 API Layer (Internal Communication)
- Node.js backend communicates with the Python ML microservice via a simple internal REST call (`axios.post('http://ml-service:8000/predict', payload)`)
- All external-facing routes are exposed only through the Node/Express API — the ML microservice and database are never directly exposed to the frontend

### 1.6 LLM Layer
- **Provider:** Groq API (Llama 3.3 70B model) — chosen for very low latency inference and a usable free tier
- **Two-stage LLM usage (critical for accuracy):**
  1. **Query Translation Stage:** LLM receives the user's natural language question + a schema description, and outputs a structured JSON filter (never raw prose at this stage).
  2. **Answer Generation Stage:** LLM receives the *actual* database results (not the raw question again) and is instructed to summarize only what is present in those results.

### 1.7 RAG (Retrieval-Augmented Generation) Layer
- **Purpose:** Prevent hallucination — the LLM must never answer from its own assumptions.
- **Flow:**
  1. Natural language question arrives.
  2. LLM converts it into a structured MongoDB filter query (JSON).
  3. Backend **validates** the generated query (checks field names against an allow-list, checks date ranges are sane) before running it — this is a mandatory safety gate.
  4. Query is executed against MongoDB; real results are retrieved.
  5. Retrieved results (not the original question) are passed to the LLM with a strict system prompt: *"Summarize only the data provided below. If no data is provided, say no matching records were found. Do not add information not present in the data."*
  6. Response is returned to the user along with a "Source: N records matched" indicator for transparency.

### 1.8 Microservices Breakdown

| Service | Responsibility | Tech |
|---|---|---|
| `client` | UI, dashboard, chat interface | React + Vite |
| `api-server` | Auth, routing, business logic, orchestrates ML + LLM calls | Node.js + Express |
| `ml-service` | Anomaly classification | Python + FastAPI + Scikit-learn |
| `mongodb` | Data persistence + vector search | MongoDB Atlas (managed, not self-hosted) |

### 1.9 Deployment Platform — Recommendation

| Component | Platform | Reason |
|---|---|---|
| **Frontend (React)** | **Vercel** | Best-in-class for React/Vite static + SSR hosting, generous free tier, automatic HTTPS, instant deploys from GitHub |
| **Backend (Node/Express)** | **Render** | Free web service tier, supports persistent Node servers (unlike serverless-only platforms), easy environment variable management, supports Socket.IO (WebSockets) which Vercel serverless does not handle well |
| **ML Microservice (Python/FastAPI)** | **Render** (separate service) | Same platform as backend for simplicity; Render supports Docker deployment for Python services cleanly |
| **Database** | **MongoDB Atlas** | Free M0 cluster, built-in Vector Search, no server management needed |
| **Version control / CI** | **GitHub** + Render/Vercel auto-deploy on push | Zero-cost CI/CD |

**Why not a single platform for everything:** Vercel is excellent for the frontend but its serverless functions are not ideal for long-running WebSocket connections or a persistent Python ML service. Render supports both as always-on services within its free/low-cost tier, so splitting frontend (Vercel) from backend + ML service (Render) gives the best reliability without added cost.

---

## 2. Full Implementation Steps and Flow (In Order — Do Not Skip Any Step)

### Phase 1: Project Setup
1. Create a GitHub monorepo with four folders: `client/`, `server/`, `ml-service/`, `docs/`.
2. Initialize `client/` with `npm create vite@latest client -- --template react`, install Tailwind CSS, Axios, React Router, Recharts, Socket.IO client.
3. Initialize `server/` with `npm init -y`, install Express, Mongoose, jsonwebtoken, bcrypt, dotenv, cors, socket.io, axios, zod, nodemailer.
4. Initialize `ml-service/` with a Python virtual environment, install fastapi, uvicorn, scikit-learn, pandas, joblib.
5. Set up a MongoDB Atlas cluster (free tier), create a database `sentinelops`, whitelist IP access, generate a connection string, store it as an environment variable.
6. Set up a Groq API account, generate an API key, store as environment variable.

### Phase 2: Database Schema Design
7. Define Mongoose schemas: `User` (name, email, passwordHash, role, createdAt), `Log` (timestamp, ip, username, status, userAgent, endpoint), `Alert` (logId ref, anomalyScore, severity, status, createdAt), `BlockedIP` (ip, blockedBy, blockedAt), `ChatHistory` (userId, question, generatedQuery, resultCount, answer, createdAt).
8. Create indexes on `Log.timestamp`, `Log.ip`, `Alert.severity` for fast queries.

### Phase 3: Authentication Module
9. Build `POST /api/auth/register` — hash password with bcrypt, save user with role.
10. Build `POST /api/auth/login` — verify password, issue JWT, optionally trigger OTP email via Nodemailer for 2FA.
11. Build `POST /api/auth/verify-otp` — confirm OTP, finalize login, return JWT.
12. Build Express middleware `authMiddleware.js` — verifies JWT on protected routes, attaches `req.user`.
13. Build `roleMiddleware.js` — restricts specific routes (e.g., block-IP action) to `admin` role only.

### Phase 4: Log Ingestion Pipeline
14. Build `POST /api/logs/ingest` — accepts a log event, validates shape with Zod, stores in `logs` collection.
15. Build a log simulator script (`server/scripts/simulateLogs.js`) that generates realistic normal and attack-pattern traffic (e.g., a burst of failed logins from one IP) and posts it to the ingest endpoint — this is your demo data generator.

### Phase 5: ML Anomaly Detection Service
16. In `ml-service/`, write `train_model.py`: load NSL-KDD/CICIDS2017 sample, extract features (failed-attempt count per IP per minute, request frequency, time-of-day, etc.), train a `RandomForestClassifier`, evaluate accuracy/precision/recall, save model as `trained_model.pkl`.
17. Write `app.py` (FastAPI): load the trained model at startup, expose `POST /predict` that accepts a batch of feature vectors and returns anomaly scores + labels.
18. In the Node backend, create `services/mlServiceClient.js` — a function that batches recent logs, extracts the same features used in training, and calls the FastAPI `/predict` endpoint.
19. Build a scheduled job (using `node-cron`, running every 10–15 seconds) that pulls unprocessed logs, sends them to the ML service, and stores results.

### Phase 6: Alert Generation and Real-Time Push
20. When an ML prediction returns an anomaly score above threshold (e.g., 0.7), create an `Alert` document with a computed severity (low/medium/high based on score bands).
21. Emit the new alert via Socket.IO (`io.emit('new_alert', alertData)`) so connected dashboards update instantly without a page refresh.

### Phase 7: Dashboard UI
22. Build the React dashboard layout: sidebar (nav), top bar (user info/logout), main panel (live alert feed + charts).
23. Connect Socket.IO client to receive `new_alert` events and prepend them to the alert list in real time.
24. Build a severity-based color-coded alert card component.
25. Build charts (Recharts) for: alerts-over-time line chart, severity distribution pie chart.

### Phase 8: Natural Language Query (RAG) Module
26. Build `POST /api/chat/query` on the backend:
    a. Receive the user's natural language question.
    b. Call Groq LLM with a system prompt containing the DB schema and an instruction to output only a JSON MongoDB filter.
    c. Parse and validate the returned JSON against an allow-list of fields (`services/queryValidator.js`) — reject/retry if invalid.
    d. Execute the validated query against MongoDB.
    e. Call Groq LLM a second time with the actual retrieved results and a strict "summarize only this data" system prompt.
    f. Save the question, generated query, result count, and answer into `ChatHistory`.
    g. Return the answer + result count to the frontend.
27. Build the React chat panel component: message list, input box, "Source: N records matched" tag under each AI response.

### Phase 9: Action Approval Workflow
28. Build `POST /api/actions/block-ip` (admin-only route) — takes an IP, adds it to `blocked_ips`, logs who approved it.
29. On the dashboard, add a "Suggest Action" button on high-severity alerts that opens a confirmation modal — action only executes after explicit admin confirmation (no fully-automated blocking).

### Phase 10: Testing
30. Write unit tests for the query validator (reject disallowed fields, reject malformed dates).
31. Write integration tests for the auth flow and the ingest → predict → alert pipeline.
32. Manually run the log simulator and confirm: logs appear → ML scores them → alerts appear on dashboard in real time → chat queries return grounded, correct answers.

### Phase 11: Deployment
33. Push `ml-service/` to Render as a Docker-based Web Service (using a `Dockerfile` with `uvicorn app:app --host 0.0.0.0 --port 8000`).
34. Push `server/` to Render as a Node Web Service; set environment variables (Mongo URI, Groq API key, JWT secret, ML service URL).
35. Push `client/` to Vercel; set environment variable for the backend API base URL.
36. Test end-to-end in production: register a user, run the log simulator against the deployed backend, confirm alerts and chat work live.

### Phase 12: Documentation
37. Write `README.md` with setup instructions, architecture diagram, and screenshots.
38. Prepare the final project report combining this document set with results/screenshots for submission.
