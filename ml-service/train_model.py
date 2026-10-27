"""
Noticia ML Microservice - Anomaly Detection Model Training
Trains a RandomForestClassifier on network and authentication security features
modeled on NSL-KDD / CICIDS2017 intrusion and brute-force attack patterns.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_score, recall_score, f1_score

FEATURE_NAMES = [
    "failed_logins_last_min",      # High during brute force (e.g. >= 5)
    "request_freq_last_min",       # Requests per minute from IP
    "hour_of_day",                 # 0 to 23
    "is_admin_endpoint",           # 1 if accessing /admin or sensitive auth endpoints, else 0
    "distinct_endpoints_count",    # High during endpoint scanning/probing
    "error_rate"                   # Ratio of 4xx/5xx responses to total
]

def generate_synthetic_security_dataset(n_samples=5000, random_seed=42):
    """
    Generates a realistic security dataset reflecting normal SOC traffic and attack patterns
    (Brute Force, Credential Stuffing, API Fuzzing, Unauthorized Admin Access).
    """
    np.random.seed(random_seed)
    
    # 80% normal traffic, 20% malicious/anomalous
    n_normal = int(n_samples * 0.80)
    n_attack = n_samples - n_normal

    # --- Normal Traffic ---
    # Low failed logins, moderate request frequency, normal business/evening hours, low error rate
    norm_failed = np.random.poisson(lam=0.2, size=n_normal)
    norm_failed = np.clip(norm_failed, 0, 3)
    norm_req_freq = np.random.gamma(shape=2.0, scale=3.0, size=n_normal) + 1.0  # ~1 to 15 req/min
    hour_probs = np.array([
        0.01, 0.01, 0.01, 0.01, 0.01, 0.02, # 00-05 low
        0.04, 0.06, 0.08, 0.09, 0.09, 0.09, # 06-11 morning peak
        0.07, 0.08, 0.08, 0.08, 0.07, 0.06, # 12-17 afternoon
        0.05, 0.03, 0.02, 0.01, 0.01, 0.01  # 18-23 evening drop
    ])
    hour_probs = hour_probs / hour_probs.sum()
    norm_hour = np.random.choice(range(24), size=n_normal, p=hour_probs)
    norm_is_admin = np.random.choice([0, 1], size=n_normal, p=[0.92, 0.08])
    norm_distinct_ep = np.random.randint(1, 4, size=n_normal)
    norm_error_rate = np.random.beta(a=1, b=9, size=n_normal) # mostly near 0.0 - 0.15
    norm_label = np.zeros(n_normal, dtype=int)

    # --- Attack Traffic ---
    # 1. Brute Force (50% of attacks): High failed logins, high frequency, specific endpoint
    n_brute = n_attack // 2
    brute_failed = np.random.randint(6, 40, size=n_brute)
    brute_req_freq = np.random.uniform(25.0, 120.0, size=n_brute)
    brute_hour = np.random.randint(0, 24, size=n_brute)
    brute_is_admin = np.random.choice([0, 1], size=n_brute, p=[0.3, 0.7])
    brute_distinct_ep = np.random.randint(1, 3, size=n_brute)
    brute_error_rate = np.random.uniform(0.70, 1.0, size=n_brute)

    # 2. Scanning / Credential Stuffing / Directory Traversal (50% of attacks)
    n_scan = n_attack - n_brute
    scan_failed = np.random.randint(2, 15, size=n_scan)
    scan_req_freq = np.random.uniform(15.0, 80.0, size=n_scan)
    scan_hour = np.random.randint(0, 24, size=n_scan)
    scan_is_admin = np.random.choice([0, 1], size=n_scan, p=[0.4, 0.6])
    scan_distinct_ep = np.random.randint(5, 25, size=n_scan)
    scan_error_rate = np.random.uniform(0.50, 0.95, size=n_scan)

    attack_failed = np.concatenate([brute_failed, scan_failed])
    attack_req_freq = np.concatenate([brute_req_freq, scan_req_freq])
    attack_hour = np.concatenate([brute_hour, scan_hour])
    attack_is_admin = np.concatenate([brute_is_admin, scan_is_admin])
    attack_distinct_ep = np.concatenate([brute_distinct_ep, scan_distinct_ep])
    attack_error_rate = np.concatenate([brute_error_rate, scan_error_rate])
    attack_label = np.ones(n_attack, dtype=int)

    # Combine
    X = pd.DataFrame({
        "failed_logins_last_min": np.concatenate([norm_failed, attack_failed]),
        "request_freq_last_min": np.concatenate([norm_req_freq, attack_req_freq]),
        "hour_of_day": np.concatenate([norm_hour, attack_hour]),
        "is_admin_endpoint": np.concatenate([norm_is_admin, attack_is_admin]),
        "distinct_endpoints_count": np.concatenate([norm_distinct_ep, attack_distinct_ep]),
        "error_rate": np.concatenate([norm_error_rate, attack_error_rate])
    })
    y = np.concatenate([norm_label, attack_label])

    return X, y

def train_and_save_model(output_path="trained_model.pkl"):
    print("Generating simulated NSL-KDD/CICIDS2017 security intrusion dataset...")
    X, y = generate_synthetic_security_dataset(n_samples=10000)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Training RandomForestClassifier on {len(X_train)} samples...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=1
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)

    print("\n--- Model Evaluation ---")
    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall:    {rec * 100:.2f}%")
    print(f"F1-Score:  {f1 * 100:.2f}%\n")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Threat/Anomaly"]))

    payload = {
        "model": clf,
        "feature_names": FEATURE_NAMES,
        "metrics": {"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}
    }

    joblib.dump(payload, output_path)
    print(f"Model successfully saved to {output_path}")
    return payload

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model_file = os.path.join(current_dir, "trained_model.pkl")
    train_and_save_model(model_file)
