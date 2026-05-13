"""
NeoGuard AI – Sepsis Prediction Backend v2.1 (LSTM + Attribution + Recommendations)
"""
import io, joblib
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import stats
from typing import List

import torch
import torch.nn as nn

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "sepsis_project" / "sepsis_project" / "models"
MODEL_PATH  = MODELS_DIR / "lstm_best.pt"
SCALER_PATH = MODELS_DIR / "lstm_scaler.pkl"
CALIB_PATH  = MODELS_DIR / "lstm_calibration.pkl"
THRESHOLD   = 0.80

# ─── Feature Config ───────────────────────────────────────────────────────────
FEATURE_COLS = [
    "mean_hr","mean_spo2","sd_hr","sd_spo2",
    "skewness_hr","skewness_spo2","kurtosis_hr","kurtosis_spo2",
    "max_xc_hr_spo2","min_xc_hr_spo2",
    "sub","sepsis_window","blackout_window"
]
FEATURE_LABELS = {
    "mean_hr":"Average Heart Rate","mean_spo2":"Average SpO₂",
    "sd_hr":"HR Variability (SD)","sd_spo2":"SpO₂ Variability (SD)",
    "skewness_hr":"HR Skewness","skewness_spo2":"SpO₂ Skewness",
    "kurtosis_hr":"HR Kurtosis","kurtosis_spo2":"SpO₂ Kurtosis",
    "max_xc_hr_spo2":"Max HR-SpO₂ Cross-Correlation",
    "min_xc_hr_spo2":"Min HR-SpO₂ Cross-Correlation",
    "sub":"Time-to-Sepsis Proximity","sepsis_window":"Sepsis Window Flag",
    "blackout_window":"Blackout Window Flag",
}
NORMAL_RANGES = {
    "mean_hr":(100,180,"bpm"),"mean_spo2":(94,100,"%"),
    "sd_hr":(0,25,"bpm"),"sd_spo2":(0,4,"%"),
    "skewness_hr":(-1,1,""),"skewness_spo2":(-1,1,""),
    "kurtosis_hr":(-2,2,""),"kurtosis_spo2":(-2,2,""),
    "max_xc_hr_spo2":(-1,1,""),"min_xc_hr_spo2":(-1,1,""),
}
CLINICAL_RECOMMENDATIONS = {
    "HIGH":[
        "🚨 Initiate Golden Hour Sepsis Protocol immediately.",
        "🔬 Draw stat blood cultures (2 sets) before antibiotics.",
        "💊 Administer empiric antibiotics: Ampicillin + Gentamicin IV within 60 minutes.",
        "🩸 Order CBC with differential, CRP, procalcitonin, blood gas.",
        "💧 Establish IV access — consider fluid resuscitation 10 mL/kg NS.",
        "📈 Continuous monitoring — escalate to Level III NICU immediately.",
    ],
    "MODERATE":[
        "⚠️ Heightened surveillance required — reassess every 2 hours.",
        "🩺 Perform full clinical exam: temperature, tone, feeding tolerance.",
        "🔬 Consider sepsis workup (CBC, CRP) if clinical deterioration noted.",
        "📊 Review vital trend over last 6 hours — escalate if worsening.",
        "👁️ Notify attending neonatologist of current risk score.",
        "💊 Hold empiric antibiotics pending clinical assessment.",
    ],
    "LOW":[
        "✅ Continue standard NICU monitoring protocols.",
        "📋 Document vital signs every 4 hours per NICU guidelines.",
        "🍼 Maintain current feeding plan — monitor for intolerance.",
        "📊 Reassess risk score at next scheduled vital check.",
        "ℹ️ No immediate pharmacological intervention required.",
    ],
}

# ─── LSTM Model ───────────────────────────────────────────────────────────────
class LSTMModel(nn.Module):
    def __init__(self, input_size=13, hidden_size=128, num_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size,
                            num_layers=num_layers, batch_first=True,
                            dropout=dropout if num_layers>1 else 0)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size,64), nn.ReLU(), nn.Dropout(dropout), nn.Linear(64,1)
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.classifier(out[:,-1,:]).squeeze(1)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="NeoGuard LSTM Sepsis API", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

lstm_model = scaler = calibrator = None
device = torch.device("cpu")

@app.on_event("startup")
def load_model():
    global lstm_model, scaler, calibrator
    print("🧠 Loading NeoGuard LSTM Sepsis Model …")
    try:
        lstm_model = LSTMModel()
        lstm_model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        lstm_model.eval()
        print(f"✅ LSTM loaded: {MODEL_PATH.name}")
    except Exception as e: print(f"❌ LSTM load failed: {e}")
    try:
        scaler = joblib.load(SCALER_PATH)
        print(f"✅ Scaler: {SCALER_PATH.name}")
    except Exception as e: print(f"⚠️ Scaler: {e}")
    try:
        calibrator = joblib.load(CALIB_PATH)
        print(f"✅ Calibrator: {CALIB_PATH.name}")
    except Exception as e: print(f"⚠️ Calibrator: {e}")
    print(f"✅ Threshold: {THRESHOLD}\n✅ LSTM Backend ready!")

# ─── Feature Extraction ───────────────────────────────────────────────────────
def extract_features(df: pd.DataFrame) -> dict:
    df.columns = [c.strip().lower().replace(" ","_") for c in df.columns]
    def get_s(cols):
        for c in cols:
            if c in df.columns:
                s = pd.to_numeric(df[c], errors="coerce").dropna().values
                if len(s): return s
        return np.array([])

    hr   = get_s(["hr","hr_raw","heart_rate"])
    spo2 = get_s(["spo2","spo2_raw","oxygen_saturation","spo2_%"])
    f = {}

    if len(hr):
        f["mean_hr"]=float(np.mean(hr)); f["sd_hr"]=float(np.std(hr))
        f["skewness_hr"]=float(stats.skew(hr)) if len(hr)>1 else 0.0
        f["kurtosis_hr"]=float(stats.kurtosis(hr)) if len(hr)>1 else 0.0
    else:
        for k in ["mean_hr","sd_hr","skewness_hr","kurtosis_hr"]:
            f[k]=float(df.get(k, pd.Series([0])).iloc[0])

    if len(spo2):
        f["mean_spo2"]=float(np.mean(spo2)); f["sd_spo2"]=float(np.std(spo2))
        f["skewness_spo2"]=float(stats.skew(spo2)) if len(spo2)>1 else 0.0
        f["kurtosis_spo2"]=float(stats.kurtosis(spo2)) if len(spo2)>1 else 0.0
    else:
        for k in ["mean_spo2","sd_spo2","skewness_spo2","kurtosis_spo2"]:
            f[k]=float(df.get(k, pd.Series([0])).iloc[0])

    try:
        ml = min(len(hr), len(spo2))
        if ml > 5:
            xc = np.correlate(hr[:ml]-np.mean(hr[:ml]), spo2[:ml]-np.mean(spo2[:ml]), mode="full")
            xc /= (np.std(hr[:ml])*np.std(spo2[:ml])*ml+1e-9)
            f["max_xc_hr_spo2"]=float(np.max(xc)); f["min_xc_hr_spo2"]=float(np.min(xc))
        else: raise ValueError()
    except:
        f["max_xc_hr_spo2"]=float(df.get("max_xc_hr_spo2", pd.Series([0])).iloc[0])
        f["min_xc_hr_spo2"]=float(df.get("min_xc_hr_spo2", pd.Series([0])).iloc[0])

    f["sub"]=float(df.get("sub", pd.Series([0])).iloc[0])
    f["sepsis_window"]=float(df.get("sepsis_window", pd.Series([0])).iloc[0])
    f["blackout_window"]=float(df.get("blackout_window", pd.Series([0])).iloc[0])
    return f

# ─── Input Gradient Attribution ───────────────────────────────────────────────
def compute_attributions(X_scaled: np.ndarray) -> List[float]:
    try:
        x = torch.tensor(X_scaled, dtype=torch.float32, requires_grad=True).unsqueeze(1)
        lstm_model.train()
        logit = lstm_model(x)
        logit.backward()
        grads = x.grad.squeeze().detach().numpy()
        lstm_model.eval()
        max_abs = np.max(np.abs(grads)) + 1e-9
        return [round(float(g/max_abs),4) for g in grads]
    except Exception as e:
        print(f"⚠️ Attribution failed: {e}")
        lstm_model.eval()
        return [0.0]*len(FEATURE_COLS)

# ─── Pydantic Models ──────────────────────────────────────────────────────────
class FeatureDetail(BaseModel):
    name: str; label: str; value: float; attribution: float
    normal_min: float; normal_max: float; unit: str; is_abnormal: bool

class PredictionResponse(BaseModel):
    sepsis_risk_pct: float; sepsis_flag: bool; risk_level: str
    raw_logit: float; calibrated_prob: float
    hr_series: List[float]; spo2_series: List[float]
    hr_mean: float; spo2_mean: float
    feature_details: List[FeatureDetail]
    recommendations: List[str]
    explanation_summary: str

# ─── /predict ─────────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    if lstm_model is None:
        raise HTTPException(503, "LSTM model not loaded.")
    try:
        df = pd.read_csv(io.StringIO((await file.read()).decode("utf-8")))
    except Exception as e:
        raise HTTPException(400, f"CSV error: {e}")
    if df.empty: raise HTTPException(400, "Empty CSV.")

    feats = extract_features(df)
    X_raw = np.array([[feats[f] for f in FEATURE_COLS]])
    X_scaled = scaler.transform(X_raw) if scaler else X_raw.copy()

    with torch.no_grad():
        logit    = lstm_model(torch.tensor(X_scaled,dtype=torch.float32).unsqueeze(1)).item()
        raw_prob = torch.sigmoid(torch.tensor(logit)).item()

    try: cal_prob = float(calibrator.predict_proba(np.array([[raw_prob]]))[0][1]) if calibrator else raw_prob
    except: cal_prob = raw_prob

    attributions = compute_attributions(X_scaled)

    sepsis_flag = raw_prob >= THRESHOLD
    risk_level  = "HIGH" if raw_prob>=THRESHOLD else ("LOW" if raw_prob<0.40 else "MODERATE")

    feature_details = []
    for i, col in enumerate(FEATURE_COLS):
        val  = feats[col]
        attr = attributions[i]
        nr   = NORMAL_RANGES.get(col,(None,None,""))
        nmin,nmax,unit = nr
        abnormal = (nmin is not None) and not (nmin<=val<=nmax)
        feature_details.append(FeatureDetail(
            name=col, label=FEATURE_LABELS.get(col,col),
            value=round(val,3), attribution=attr,
            normal_min=nmin or 0.0, normal_max=nmax or 0.0,
            unit=unit, is_abnormal=abnormal
        ))

    top_sorted = sorted(zip([FEATURE_LABELS[c] for c in FEATURE_COLS], attributions), key=lambda x:x[1], reverse=True)
    top3 = [n for n,v in top_sorted if v>0.1][:3]
    bot2 = [n for n,v in reversed(top_sorted) if v<-0.1][:2]
    parts=[]
    if top3: parts.append(f"Primary risk drivers: **{', '.join(top3)}**.")
    if bot2: parts.append(f"Protective factors: **{', '.join(bot2)}**.")
    parts.append(f"Predicted probability: **{round(raw_prob*100,1)}%** (decision threshold: {int(THRESHOLD*100)}%).")
    explanation = " ".join(parts)

    df.columns=[c.strip().lower().replace(" ","_") for c in df.columns]
    hrc  = next((c for c in ["hr","hr_raw","heart_rate"] if c in df.columns),None)
    sc   = next((c for c in ["spo2","spo2_raw","oxygen_saturation"] if c in df.columns),None)
    hr_s = pd.to_numeric(df[hrc],errors="coerce").dropna().tolist()[-24:] if hrc else []
    sp_s = pd.to_numeric(df[sc], errors="coerce").dropna().tolist()[-24:] if sc  else []

    return PredictionResponse(
        sepsis_risk_pct=round(raw_prob*100,1), sepsis_flag=bool(sepsis_flag),
        risk_level=risk_level, raw_logit=round(logit,4), calibrated_prob=round(cal_prob,4),
        hr_series=hr_s, spo2_series=sp_s,
        hr_mean=round(feats["mean_hr"],1), spo2_mean=round(feats["mean_spo2"],1),
        feature_details=feature_details,
        recommendations=CLINICAL_RECOMMENDATIONS[risk_level],
        explanation_summary=explanation,
    )

class SimulateRequest(BaseModel):
    features: dict

class SimulateResponse(BaseModel):
    sepsis_risk_pct: float
    sepsis_flag: bool
    risk_level: str
    recommendations: List[str]

@app.post("/simulate_twin", response_model=SimulateResponse)
async def simulate_twin(req: SimulateRequest):
    if lstm_model is None:
        raise HTTPException(503, "LSTM model not loaded.")
    
    feats = req.features
    X_raw = np.array([[feats.get(f, 0.0) for f in FEATURE_COLS]])
    X_scaled = scaler.transform(X_raw) if scaler else X_raw.copy()

    with torch.no_grad():
        logit = lstm_model(torch.tensor(X_scaled,dtype=torch.float32).unsqueeze(1)).item()
        raw_prob = torch.sigmoid(torch.tensor(logit)).item()

    sepsis_flag = raw_prob >= THRESHOLD
    risk_level  = "HIGH" if raw_prob>=THRESHOLD else ("LOW" if raw_prob<0.40 else "MODERATE")

    return SimulateResponse(
        sepsis_risk_pct=round(raw_prob*100,1),
        sepsis_flag=bool(sepsis_flag),
        risk_level=risk_level,
        recommendations=CLINICAL_RECOMMENDATIONS[risk_level]
    )

@app.get("/health")
def health():
    return {"status":"ok","model":"LSTM","model_loaded":lstm_model is not None,"threshold":THRESHOLD}
