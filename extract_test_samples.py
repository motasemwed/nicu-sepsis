"""
Extract real test samples from test_forecast24.csv
Creates hr/spo2 time-series CSVs compatible with the NeoGuard upload system.
"""
import pandas as pd
import numpy as np
import os

TEST_FILE = r"sepsis_project\sepsis_project\data\test_forecast24.csv"
OUT_DIR   = "test_samples"
os.makedirs(OUT_DIR, exist_ok=True)

print("Reading test file (first 50,000 rows)...")
# Read only first chunk — fast
df = pd.read_csv(TEST_FILE, nrows=50000)
print(f"Loaded: {df.shape[0]} rows, {df.shape[1]} cols")
print(f"Columns: {list(df.columns)}")
print(f"\nLabel distribution (y_forecast_24h):")
print(df['y_forecast_24h'].value_counts())

# Get unique patients
patients = df['new_id'].unique()
print(f"\nUnique patients: {len(patients)}")

# ── Pick 3 sepsis-positive patients ──
pos_patients = df[df['y_forecast_24h'] == 1]['new_id'].unique()[:3]
neg_patients = df[df['y_forecast_24h'] == 0]['new_id'].unique()[:2]

print(f"\nSepsis-positive patients to extract: {pos_patients}")
print(f"Sepsis-negative patients to extract: {neg_patients}")

# Feature cols used in LSTM
FEAT_COLS = ['mean_hr', 'mean_spo2', 'sd_hr', 'sd_spo2',
             'skewness_hr', 'skewness_spo2', 'kurtosis_hr', 'kurtosis_spo2',
             'max_xc_hr_spo2', 'min_xc_hr_spo2',
             'sub', 'sepsis_window', 'blackout_window']

def save_patient(pid, label, idx):
    pdata = df[df['new_id'] == pid].sort_values('seconds_since_birth')
    # Take up to 144 rows (24 hours of 10-min intervals)
    pdata = pdata.head(144)

    # Build a "raw vitals" style CSV that backend can consume
    out = pdata[FEAT_COLS].copy()
    # Rename to match backend column detection
    out = out.rename(columns={'mean_hr': 'hr', 'mean_spo2': 'spo2'})
    out['birth_weight'] = 1200  # default since not in per-row data

    fname = f"{OUT_DIR}/patient_{label}_{idx:02d}_pid{pid}.csv"
    out.to_csv(fname, index=False)
    print(f"  Saved: {fname}  ({len(out)} rows, true_label={label})")
    return fname

print("\n--- Extracting samples ---")
for i, pid in enumerate(pos_patients):
    save_patient(pid, 'SEPSIS', i+1)

for i, pid in enumerate(neg_patients):
    save_patient(pid, 'HEALTHY', i+1)

print(f"\nDone! Files saved in '{OUT_DIR}/' — ready to upload to NeoGuard.")
print("Drag any of these CSV files into the Sepsis Telemetry upload zone to test.")
