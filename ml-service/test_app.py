import sys
from fastapi.testclient import TestClient
from app import app, load_model

load_model()
client = TestClient(app)

# 1. Test Health
res_health = client.get("/health")
assert res_health.status_code == 200, f"Health check failed: {res_health.text}"
print("Health Check Passed:", res_health.json())

# 2. Test Predict: Normal traffic sample vs Brute-force attack sample
payload = {
    "logs": [
        {
            "log_id": "normal_1",
            "failed_logins_last_min": 0,
            "request_freq_last_min": 3.5,
            "hour_of_day": 14,
            "is_admin_endpoint": 0,
            "distinct_endpoints_count": 2,
            "error_rate": 0.05
        },
        {
            "log_id": "brute_force_1",
            "failed_logins_last_min": 25,
            "request_freq_last_min": 75.0,
            "hour_of_day": 3,
            "is_admin_endpoint": 1,
            "distinct_endpoints_count": 1,
            "error_rate": 0.95
        }
    ]
}

res_pred = client.post("/predict", json=payload)
assert res_pred.status_code == 200, f"Predict failed: {res_pred.text}"
data = res_pred.json()
print("Predict Output:", data)

norm_pred = data["predictions"][0]
attack_pred = data["predictions"][1]

assert norm_pred["is_anomaly"] is False, f"Expected normal log to NOT be anomaly, got {norm_pred}"
assert attack_pred["is_anomaly"] is True, f"Expected attack log to BE anomaly, got {attack_pred}"
assert attack_pred["severity"] in ["high", "medium"], f"Expected high/medium severity, got {attack_pred['severity']}"

print("\nALL ML-SERVICE TESTS PASSED SUCCESSFULLY!")
