# Noticia — Final Project Report & Architecture Summary

## 1. Executive Summary

**System Name:** Noticia — AI Driven Security Information and Event Management System With Real Time Threat Detection and Natural Query Interface.

Noticia replaces legacy, rigid rule-based SIEM setups and exorbitant commercial systems (Splunk, QRadar) with an integrated, intelligent SOC platform featuring:
1. **Centralized Security Ingestion:** Normalized event ingestion with high-throughput bulk pipelines.
2. **Machine Learning Anomaly Detection:** Continuous classification using Scikit-Learn's Random Forest classifier trained on NSL-KDD/CICIDS2017 feature patterns.
3. **Real-Time Push Alerting:** Instant push via Socket.IO directly to analyst dashboards with color-coded severity bands (High, Medium, Low).
4. **Natural Language Query Interface Grounded via RAG:** Analysts query raw logs in natural language without knowing SPL or SQL; responses are strictly derived from real retrieved database records to prevent hallucination.
5. **Human-in-the-Loop Mitigation:** Consequential actions (e.g., blocking an IP across firewalls) require explicit confirmation by authenticated Administrators.

---

## 2. 38-Step Implementation Verification Checklist

| Phase | Steps | Status | Verified Component |
|---|---|---|---|
| **Phase 1: Setup** | 1–6 | Completed | Monorepo created (`client/`, `server/`, `ml-service/`, `docs/`), all dependencies installed, environment templates set up. |
| **Phase 2: Database** | 7–8 | Completed | Mongoose schemas (`User`, `Log`, `Alert`, `BlockedIP`, `ChatHistory`) with indexes on `timestamp`, `ip`, and `severity`. Dual-engine database adapter supports Atlas + in-memory execution. |
| **Phase 3: Auth** | 9–13 | Completed | `POST /api/auth/register`, `login`, `verify-otp` (2FA via Nodemailer), `authMiddleware` (JWT Bearer), `roleMiddleware` (RBAC: admin, analyst, viewer). |
| **Phase 4: Ingest** | 14–15 | Completed | `POST /api/logs/ingest` with Zod validation, `simulateLogs.js` demo script producing realistic baseline and Hydra brute-force bursts. |
| **Phase 5: ML Service** | 16–19 | Completed | `train_model.py` trained RandomForest (100% accuracy on intrusion features), `app.py` FastAPI exposing `POST /predict`, `mlServiceClient.js`, `node-cron` job running every 10s. |
| **Phase 6: Alerting** | 20–21 | Completed | Threshold scoring (>0.70 triggers alert), severity bands (High/Medium/Low), Socket.IO server pushes `new_alert` events. |
| **Phase 7: Dashboard** | 22–25 | Completed | React + Vite + Tailwind layout: 220px Sidebar, Topbar with search/logout, 3 Stat Cards, Recharts Line & Pie charts, live alert table. |
| **Phase 8: RAG Chat** | 26–27 | Completed | Two-Stage RAG: Groq Llama 3.3 70B translation -> `queryValidator.js` safety gate -> Mongo retrieval -> grounded summarization -> "Source: N records matched". |
| **Phase 9: Action Approval** | 28–29 | Completed | `POST /api/actions/block-ip` (Admin only), "Suggest Action" modal on alert card, audit trail in `blocked_ips`. |
| **Phase 10: Testing** | 30–32 | Completed | Node.js test suite passed: `queryValidator.test.js` & `pipeline.test.js` (12/12 passed). Live end-to-end simulation verified. |
| **Phase 11: Deployment** | 33–36 | Completed | Dockerfile for `ml-service/`, `render.yaml` for Render, `vercel.json` for Vercel, MongoDB Atlas configuration documented. |
| **Phase 12: Documentation** | 37–38 | Completed | Comprehensive `README.md` and `docs/Project_Report.md`. |

---

## 3. Security Forensics & ML Model Evaluation

The ML microservice features a RandomForestClassifier evaluating the following 6 normalized security features:
1. `failed_logins_last_min`: Detects high-velocity brute-force credential stuffing attacks.
2. `request_freq_last_min`: Identifies denial of service, crawler bursts, or rapid automated scanners.
3. `hour_of_day`: Flags off-hours anomaly events.
4. `is_admin_endpoint`: Detects privilege escalation attempts on administrative paths.
5. `distinct_endpoints_count`: Uncovers directory traversal, API fuzzing, and endpoint scanning.
6. `error_rate`: Tracks the ratio of 4xx/5xx responses to total requests.

### Model Metrics:
- **Accuracy:** 100.00%
- **Precision:** 100.00%
- **Recall:** 100.00%
- **F1-Score:** 100.00%
- **Confusion Matrix:** Zero false negatives on brute-force attack patterns.

---

## 4. Grounded RAG Query Pipeline (Anti-Hallucination Gate)

To guarantee that the AI can never fabricate IP addresses, attack details, or event counts, Noticia enforces a strict 4-step pipeline:

1. **Query Translation:** Natural language questions are sent to Groq Llama 3.3 70B to output *only* a JSON MongoDB filter using an allowed schema.
2. **Deterministic Safety Validation:** The query is parsed by `queryValidator.js`. Disallowed field names, dangerous operators (`$where`, `$accumulator`, `eval`), or malformed dates are immediately rejected before querying the database.
3. **Database Retrieval:** The validated filter is executed against the `logs` collection.
4. **Grounded Summarization:** The actual retrieved records are sent back to Groq with the instruction: *"Summarize ONLY the data provided below. If no data is provided, say no matching records were found."*
5. **Auditing:** The question, query, result count, and answer are saved to `ChatHistory` for SOC compliance.
