import os
import joblib
import pandas as pd
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Noticia ML Anomaly Detection Service",
    description="Real-time threat and anomaly scoring service powered by Scikit-Learn RandomForest",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "trained_model.pkl")
model_data = None

@app.on_event("startup")
def load_model():
    global model_data
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model file not found at {MODEL_PATH}. Run train_model.py first.")
    model_data = joblib.load(MODEL_PATH)
    print("Noticia ML Model loaded successfully into memory.")

class FeatureVector(BaseModel):
    log_id: Optional[str] = None
    failed_logins_last_min: float = Field(0.0, description="Count of failed login attempts from this IP in past min")
    request_freq_last_min: float = Field(1.0, description="Request count / frequency per minute")
    hour_of_day: int = Field(12, ge=0, le=23, description="Hour of the day 0-23")
    is_admin_endpoint: int = Field(0, ge=0, le=1, description="1 if admin/auth sensitive endpoint, else 0")
    distinct_endpoints_count: int = Field(1, ge=1, description="Count of distinct endpoints accessed")
    error_rate: float = Field(0.0, ge=0.0, le=1.0, description="Error rate 0.0 to 1.0 (4xx/5xx ratio)")

class BatchPredictRequest(BaseModel):
    logs: List[FeatureVector]

class PredictionResult(BaseModel):
    log_id: Optional[str] = None
    anomaly_score: float
    is_anomaly: bool
    predicted_label: str
    severity: str

class BatchPredictResponse(BaseModel):
    success: bool
    total_processed: int
    predictions: List[PredictionResult]

@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Noticia ML Anomaly Detection Service",
        "model_loaded": model_data is not None,
        "features": model_data["feature_names"] if model_data else [],
        "metrics": model_data["metrics"] if model_data else {}
    }

@app.post("/predict", response_model=BatchPredictResponse)
def predict_anomalies(request: BatchPredictRequest):
    if not model_data or "model" not in model_data:
        raise HTTPException(status_code=500, detail="ML model is not loaded")

    if not request.logs:
        return BatchPredictResponse(success=True, total_processed=0, predictions=[])

    feature_names = model_data["feature_names"]
    clf = model_data["model"]

    rows = []
    for item in request.logs:
        rows.append({
            "failed_logins_last_min": item.failed_logins_last_min,
            "request_freq_last_min": item.request_freq_last_min,
            "hour_of_day": item.hour_of_day,
            "is_admin_endpoint": item.is_admin_endpoint,
            "distinct_endpoints_count": item.distinct_endpoints_count,
            "error_rate": item.error_rate
        })

    df = pd.DataFrame(rows, columns=feature_names)
    probabilities = clf.predict_proba(df)
    # Check shape: classes may be [0, 1]
    classes = list(clf.classes_)
    anomaly_col_idx = classes.index(1) if 1 in classes else 0

    results: List[PredictionResult] = []
    for i, item in enumerate(request.logs):
        score = float(probabilities[i][anomaly_col_idx])
        is_anomaly = score >= 0.70

        if score >= 0.85:
            severity = "high"
        elif score >= 0.70:
            severity = "medium"
        elif score >= 0.40:
            severity = "low"
        else:
            severity = "none"

        results.append(PredictionResult(
            log_id=item.log_id,
            anomaly_score=round(score, 4),
            is_anomaly=is_anomaly,
            predicted_label="ANOMALY" if is_anomaly else "NORMAL",
            severity=severity
        ))

    return BatchPredictResponse(
        success=True,
        total_processed=len(results),
        predictions=results
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
