import requests, json, numpy as np
np.random.seed(42)

base = 'http://127.0.0.1:8000'
results = []

# 1. Health
r = requests.get(base + '/health')
d = r.json()
results.append(('health_status_200', r.status_code == 200))
results.append(('model_loaded',      d.get('model_loaded') == True))
results.append(('threshold_0.8',     d.get('threshold') == 0.8))
results.append(('model_is_LSTM',     'LSTM' in str(d.get('model', ''))))

# 2. High-risk predict
hr   = [200 + i % 10 for i in range(20)]
spo2 = [70  + i % 5  for i in range(20)]
csv  = 'hr,spo2,birth_weight\n' + '\n'.join('{},{},1200'.format(h, s) for h, s in zip(hr, spo2))
r2   = requests.post(base + '/predict', files={'file': ('hi.csv', csv.encode(), 'text/csv')})
d2   = r2.json() if r2.status_code == 200 else {}
results.append(('predict_200',          r2.status_code == 200))
results.append(('has_risk_pct',         'sepsis_risk_pct' in d2))
results.append(('has_features_13',      len(d2.get('feature_details', [])) == 13))
results.append(('has_recommendations',  len(d2.get('recommendations', [])) > 0))
results.append(('has_explanation',      len(d2.get('explanation_summary', '')) > 10))
results.append(('has_risk_level',       d2.get('risk_level') in ('HIGH', 'MODERATE', 'LOW')))
attrs = [f['attribution'] for f in d2.get('feature_details', [])]
results.append(('attributions_in_range',all(-1.01 <= a <= 1.01 for a in attrs) if attrs else False))
results.append(('hr_mean_abnormal',     d2.get('hr_mean', 0) > 180))
results.append(('spo2_mean_abnormal',   d2.get('spo2_mean', 100) < 80))

# 3. Low-risk predict
csv3 = 'hr,spo2,birth_weight\n' + '\n'.join('140,98,1200' for _ in range(20))
r3   = requests.post(base + '/predict', files={'file': ('lo.csv', csv3.encode(), 'text/csv')})
d3   = r3.json() if r3.status_code == 200 else {}
results.append(('lowrisk_predict_200',    r3.status_code == 200))
results.append(('lowrisk_has_recs',       len(d3.get('recommendations', [])) > 0))
results.append(('lowrisk_level_valid',    d3.get('risk_level') in ('HIGH', 'MODERATE', 'LOW')))

# 4. Schema keys
req_keys = ['sepsis_risk_pct','sepsis_flag','risk_level','raw_logit','calibrated_prob',
            'hr_series','spo2_series','hr_mean','spo2_mean',
            'feature_details','recommendations','explanation_summary']
for k in req_keys:
    results.append(('schema_key_' + k, k in d2))

# Print summary
passed = sum(1 for _, v in results if v)
failed = sum(1 for _, v in results if not v)
total  = len(results)

print('\nNeoGuard Validation Results')
print('=' * 50)
for name, ok in results:
    print('  {}  {}'.format('PASS' if ok else 'FAIL', name))

print('\n' + '=' * 50)
print('Total   : {}'.format(total))
print('Passed  : {}'.format(passed))
print('Failed  : {}'.format(failed))
print()

if failed == 0:
    print('ALL CHECKS PASSED - NeoGuard system fully operational!')
else:
    print('{} check(s) failed - review above'.format(failed))

print()
print('--- High-risk result ---')
print('Risk score : {}%'.format(d2.get('sepsis_risk_pct')))
print('Risk level : {}'.format(d2.get('risk_level')))
print('HR mean    : {} bpm'.format(d2.get('hr_mean')))
print('SpO2 mean  : {}%'.format(d2.get('spo2_mean')))
print('Explanation: {}'.format(d2.get('explanation_summary', '')[:100]))
print()
print('--- Low-risk result ---')
print('Risk score : {}%'.format(d3.get('sepsis_risk_pct')))
print('Risk level : {}'.format(d3.get('risk_level')))
print('First rec  : {}'.format(d3.get('recommendations', [''])[0][:70]))
