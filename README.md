# Noticia — AI-Driven Security Information & Event Management (SIEM)

> **Real-Time ML Threat Detection & Natural Language Query Interface Grounded via RAG (Zero Hallucination)**

Noticia is a next-generation, web-based SIEM platform engineered for modern Security Operations Centers (SOCs). It continuously ingests enterprise security logs, scores incoming events for anomalies in real time using a Scikit-Learn Random Forest model, pushes live threat alerts across WebSockets, and allows security analysts to investigate threats using plain-English queries grounded via a Two-Stage Retrieval-Augmented Generation (RAG) architecture powered by Groq (Llama 3.3 70B).

---

## 1. System Architecture

```
                                 [ Security Logs / Ingestion Sources ]
                                                  |
                                                  v
                                     [ POST /api/logs/ingest ]
                                                  |
                                                  +-------------------------+
                                                  |                         |
                                                  v                         v
                                         [ MongoDB / Mongoose ]     [ node-cron Job ]
                                                  |                         |
                                                  |   (Fetch unprocessed)   v
                                                  |                 [ Feature Extractor ]
                                                  |                         |
                                                  |        (POST /predict)  v
                                                  |            [ FastAPI ML Microservice ]
                                                  |            (RandomForestClassifier)
                                                  |                         |
                                                  |    (Anomaly Score > 0.70)
                                                  |                         v
                                                  |               [ Generate Alert ]
                                                  |                         |
                                                  v                         v
                                           [ dbStore ] <------+-- [ Socket.IO Server ]
                                                              |             |
                                                              |             v (push 'new_alert')
    [ Analyst Browser: React + Vite + Tailwind ] <------------+-------------+
            |
            | (Natural Language Query: "Show failed logins today")
            v
    [ POST /api/chat/query ]
            |
            v  Stage 1: Translate NL to structured JSON query
    [ Groq API: Llama 3.3 70B ]
            |
            v  Stage 2: Strict Validation Safety Gate (queryValidator.js)
    [ Field Allowlist & Date Sanity Check ] ---> (Reject if invalid)
            |
            v  Stage 3: Retrieve real matching records
    [ Execute Query on db.logs ]
            |
            v  Stage 4: Grounded Summarization ("Summarize ONLY this data")
    [ Groq API: Llama 3.3 70B ]
            |
            v (Returns answer + "Source: N records matched")
    [ Analyst Chat Feed ]
```

---

## 2. Monorepo Structure

```
NOTICIA/
├── client/                     # Frontend (React 18 + Vite + Tailwind CSS + Recharts)
│   ├── src/
│   │   ├── components/         # Alert cards, detail panel, modals, layout
│   │   ├── context/            # AuthContext (in-memory JWT), SocketContext
│   │   ├── pages/              # Login, Dashboard, Alerts, Chat, Blocked IPs, Settings
│   │   └── services/           # Axios client with interceptors
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json             # Vercel SPA routing
├── server/                     # Core Backend (Node.js + Express + Socket.IO + Mongoose)
│   ├── config/                 # MongoDB / Memory fallback connection
│   ├── cron/                   # node-cron scheduled ML threat pipeline (every 10s)
│   ├── middleware/             # authMiddleware (JWT), roleMiddleware (RBAC), serviceAuth
│   ├── models/                 # User, Log, Alert, BlockedIP, ChatHistory
│   ├── routes/                 # Auth, Dashboard, Logs, Alerts, Chat, Actions, Users
│   ├── scripts/                # simulateLogs.js, verifyLiveSystem.js
│   ├── services/               # mlServiceClient, queryValidator, ragService, emailService
│   ├── tests/                  # Node.js native test suite (queryValidator & pipeline)
│   ├── .env.example
│   └── server.js
├── ml-service/                 # ML Microservice (Python + FastAPI + Scikit-Learn)
│   ├── app.py                  # FastAPI server exposing POST /predict
│   ├── train_model.py          # RandomForest training script (NSL-KDD features)
│   ├── test_app.py             # TestClient verification script
│   ├── trained_model.pkl       # Serialized trained model
│   ├── requirements.txt
│   └── Dockerfile              # Container deployment for Render
├── docs/                       # Project specifications and final report
├── render.yaml                 # 1-Click Multi-Service deployment blueprint
└── README.md
```

---

## 3. Environment Variables & Placeholders

Copy `server/.env.example` to `server/.env` and configure your credentials:

| Variable | Description | Default / Fallback |
|---|---|---|
| `PORT` | Node.js backend port | `5000` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `MONGODB_URI` | MongoDB Atlas connection string | Falls back to embedded in-memory database |
| `JWT_SECRET` | Secret key for signing authentication JWTs | Pre-configured secure key |
| `SERVICE_KEY` | Header key (`x-service-key`) for sensor log ingestion | `noticia_internal_service_key_987654321` |
| `GROQ_API_KEY` | Groq API Key for Llama 3.3 70B | Falls back to local deterministic semantic engine |
| `ML_SERVICE_URL` | URL of the Python FastAPI ML microservice | `http://localhost:8000` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `EMAIL_HOST` | SMTP host for 2FA OTP codes | `smtp.ethereal.email` (Ethereal test account) |

---

## 4. Local Quickstart (Step-by-Step)

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### Step 1: Start the Python ML Microservice
```bash
cd ml-service
python -m pip install -r requirements.txt
python train_model.py
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```
*Health check:* Open `http://localhost:8000/health` (returns `model_loaded: true`).

### Step 2: Start the Node.js Express Backend
Open a second terminal:
```bash
cd server
npm install
npm start
```
*Backend runs on:* `http://localhost:5000`

### Step 3: Run the Log Simulator (Demo Data Generator)
Open a third terminal:
```bash
cd server
npm run simulate
```
This generates 25 baseline events, a 16-attempt Hydra brute-force login attack on `/api/auth/login`, and an admin endpoint scan. The ML pipeline scores them, generating high-severity alerts.

### Step 4: Start the Frontend UI
Open a fourth terminal:
```bash
cd client
npm install
npm run dev
```
*Access Noticia:* Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Running the Automated Test Suite

### Unit & Integration Backend Tests
```bash
cd server
npm test
```
Executes 12 automated tests covering:
- Query validator field allowlisting
- Rejection of malformed / absurd date ranges (year 1900)
- Rejection of MongoDB injection operators (`$where`, `$accumulator`, `eval`)
- User registration, 2FA OTP generation and verification
- Log ingestion & ML pipeline scoring
- Real-time alert generation & severity bands
- Admin action mitigation (blocking IP)
- RAG natural language grounded query verification

### ML Service Model Verification
```bash
cd ml-service
python test_app.py
```

---

## 6. Cloud Deployment Instructions

### 6.1 Database: MongoDB Atlas
1. Create a free M0 cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create database user and allow IP access (`0.0.0.0/0` or Render outbound IPs).
3. Copy connection string (`mongodb+srv://<user>:<password>@cluster0.mongodb.net/noticia?retryWrites=true&w=majority`).
4. Set as `MONGODB_URI` on Render.

### 6.2 ML Microservice: Render (Docker Web Service)
1. In Render, select **New > Web Service** connected to your repo.
2. Root Directory: `ml-service`
3. Environment: `Docker`
4. Set Port: `8000`

### 6.3 Backend API Server: Render (Node Web Service)
1. In Render, select **New > Web Service**.
2. Root Directory: `server`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Configure Environment Variables: `MONGODB_URI`, `JWT_SECRET`, `SERVICE_KEY`, `GROQ_API_KEY`, `ML_SERVICE_URL`.

### 6.4 Frontend: Vercel
1. In [Vercel](https://vercel.com), import your repository.
2. Root Directory: `client`
3. Framework Preset: `Vite`
4. Add Environment Variable:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://noticia-api.onrender.com`)
   - `VITE_WS_URL`: Your Render backend URL for WebSockets
5. Deploy.
