document.addEventListener('DOMContentLoaded', () => {

    /* --- 1. Global Time --- */
    const updateTime = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
        document.getElementById('clock').textContent = timeStr + ' UTC';
        document.getElementById('date').textContent = dateStr;
    };
    setInterval(updateTime, 1000);
    updateTime();

    /* --- 2. Advanced Navigation Routing --- */
    window.switchView = function(targetId) {
        const navItem = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if(navItem) navItem.click();
    };

    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const viewMeta = {
        'dashboard-hub': { t: 'Command Hub', st: 'Centralized overview of modules.'},
        'live-monitor': { t: 'Sepsis Telemetry', st: 'Real-time vital extraction & Golden Hour Tracking.'},
        'shift-handoff': { t: 'Gen-AI Shift Handoff', st: 'Generative clinical summaries for doctors.', class: 'nav-gold' },
        'ab-monitor': { t: 'A&B Spell Monitor', st: 'Apnea & Bradycardia timeline.', class: 'nav-purple' },
        'npass-vision': { t: 'N-PASS Pain Vision', st: 'Neonatal facial distress.', class: 'nav-purple' },
        'charting-engine': { t: 'Automated Charting', st: 'HL7/FHIR Integration Logs.', class: 'nav-green' },
        'model-intelligence': { t: 'Model Intelligence', st: 'LSTM Model Performance & Architecture Details.', class: 'nav-blue' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active', 'nav-purple', 'nav-green', 'nav-orange', 'nav-blue', 'nav-gold'));
            sections.forEach(sec => sec.classList.remove('active'));
            
            const target = item.getAttribute('data-target');
            const meta = viewMeta[target];
            
            item.classList.add('active');
            if(meta.class) item.classList.add(meta.class);
            
            const targetSection = document.getElementById(target);
            if(targetSection) targetSection.classList.add('active');

            pageTitle.textContent = meta.t;
            pageSubtitle.textContent = meta.st;

            if(target === 'model-intelligence') {
                animateModelIntelligence();
            }
        });
    });

    /* --- 3. Telemetry Engine & Golden Hour Buttons --- */
    const generateSparkline = (dataPoints, status) => {
        const max = Math.max(...dataPoints, 100) * 1.05;
        const min = Math.min(...dataPoints, 0) * 0.95;
        const width = 100, height = 35;
        const pathPoints = dataPoints.map((val, i) => `${i === 0 ? 'M' : 'L'} ${(i / (dataPoints.length - 1)) * width} ${height - ((val - min) / (max - min)) * height}`).join(' ');
        let strokeColor = status === 'sepsis-critical' ? '#f43f5e' : '#5eead4';
        return `<svg class="chart-mini" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path d="${pathPoints}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" /></svg>`;
    };

    const patients = [
        { id: 'NICU-9402', name: 'Baby A. Smith', hr: [135,140,138,142,141], spo2: [96,96,95,96,96], sepsRsk: 12 },
        { id: 'NICU-8311', name: 'Baby J. Doe', hr: [155,160,165,162,168], spo2: [93,92,94,91,92], sepsRsk: 45 },
        { id: 'NICU-7729', name: 'Baby L. Garcia', hr: [185,188,187,185,189], spo2: [88,89,86,85,84], sepsRsk: 88, critical: true }, 
        { id: 'NICU-4910', name: 'Baby M. Chen', hr: [130,132,135,134,136], spo2: [98,99,98,97,98], sepsRsk: 8 },
        { id: 'NICU-5520', name: 'Baby P. Patel', hr: [140,145,142,145,148], spo2: [95,93,94,95,94], sepsRsk: 25 }
    ];

    const pGrid = document.getElementById('patient-grid');

    const renderPatients = () => {
        if(!pGrid) return;
        pGrid.innerHTML = '';

        patients.forEach(p => {
            const hrCur = p.hr[p.hr.length - 1];
            const spo2Cur = p.spo2[p.spo2.length - 1];
            
            let baseClass = 'state-stable';
            let vStatus = 'stable';
            if (p.sepsRsk > 30) { baseClass = 'state-warning'; vStatus = 'sepsis-warn'; }
            if (p.sepsRsk > 75 || p.critical) { baseClass = 'state-critical'; vStatus = 'sepsis-critical'; }

            let ghButton = '';
            if(baseClass === 'state-critical') {
                ghButton = `<button class="btn-golden-hour" onclick="openGoldenHour('${p.name}', ${p.sepsRsk})">
                                <i class="ph-bold ph-warning-octagon"></i> Initiate Golden Hour
                            </button>`;
            }

            const card = document.createElement('div');
            card.className = `p-card glass ${baseClass}`;
            card.innerHTML = `
                <div class="p-header">
                    <div class="p-identity">
                        <div class="name">${p.name}</div>
                        <div class="pid">Sepsis Risk: ${p.sepsRsk}%</div>
                    </div>
                </div>
                <div class="vitals-grid">
                    <div class="v-box">
                        <div class="v-label"><span>HR</span></div>
                        <div class="v-val">${hrCur}</div>
                        ${generateSparkline(p.hr, vStatus)}
                    </div>
                    <div class="v-box">
                        <div class="v-label"><span>SpO2</span></div>
                        <div class="v-val">${spo2Cur}</div>
                        ${generateSparkline(p.spo2, vStatus)}
                    </div>
                </div>
                ${ghButton}
                ${p.aiResult ? `<button class="btn-view-ai" onclick="openResultsModal('${p.id}')"><i class="ph-fill ph-brain"></i> View AI Analysis</button>` : ''}
            `;
            if(p.aiResult) card.dataset.aiId = p.id;
            pGrid.appendChild(card);
        });
    };
    renderPatients();

    /* --- Golden Hour Protocol Logic --- */
    let ghInterval;
    window.openGoldenHour = function(patientName, risk) {
        document.getElementById('gh-modal').classList.add('active');
        document.getElementById('gh-patient-name').textContent = patientName;
        
        let timeLeft = 3600; // 60 mins in seconds
        document.getElementById('gh-timer').textContent = "60:00";
        clearInterval(ghInterval);
        
        ghInterval = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('gh-timer').textContent = `${m}:${s}`;
        }, 1000);
    };

    window.closeGoldenHour = function() {
        document.getElementById('gh-modal').classList.remove('active');
        clearInterval(ghInterval);
        // Reset checklist
        document.querySelectorAll('.checklist-item').forEach(el => el.classList.remove('checked'));
    };

    window.toggleCheck = function(element) {
        element.classList.toggle('checked');
    };

    /* --- Shift Handoff LLM Logic --- */
    let selectedPtHandoff = 'Baby A. Smith';
    window.selectPatientHandoff = function(el, name) {
        document.querySelectorAll('.pt-select').forEach(node => node.classList.remove('active'));
        el.classList.add('active');
        selectedPtHandoff = name;
        document.getElementById('summary-box').innerHTML = `
            <div style="text-align:center; color:var(--text-muted); opacity:0.5; margin-top:20%;">
                <i class="ph-thin ph-magic-wand" style="font-size:4rem; margin-bottom:1rem;"></i>
                <p>Ready to generate shift notes for ${name}.</p>
            </div>`;
    };

    window.generateHandoff = function() {
        const box = document.getElementById('summary-box');
        box.innerHTML = `<div class="markdown-body" id="typewriter-text"></div>`;
        const textContainer = document.getElementById('typewriter-text');
        
        // Find if it's a dynamic AI patient
        const aiPt = patients && typeof patients !== 'undefined' ? patients.find(p => p.name === selectedPtHandoff) : null;
        let template = ``;

        if (aiPt) {
            const r = aiPt.aiResult;
            const isHigh = r.risk_level === 'HIGH';
            template = `### Shift Summary: ${aiPt.name}\n\nOver the last shift, patient has been evaluated by the Deep Learning framework yielding <span class="${isHigh ? 'critical' : 'stable'}">${isHigh ? 'signs of physiological instability' : 'stable metrics'}</span>.\n\n- **Cardiovascular:** Heart Rate averaged at ${Math.round(r.hr_mean)} bpm.\n- **Respiratory:** SpO2 averaged at ${Math.round(r.spo2_mean)}%.\n- **AI Insights:** The NeoGuard Sepsis Prediction Engine has triggered a **${r.risk_level} Risk Alert (${r.sepsis_risk_pct}%)**. \n\n**Summary Details:** ${r.explanation_summary}\n\n**Recommendation for morning team:** ${r.recommendations[0]}`;
        } else if(selectedPtHandoff === 'Baby L. Garcia') {
            template = `### Shift Summary: ${selectedPtHandoff}\n\nOver the last 12 hours, patient has exhibited <span class="critical">significant physiological instability</span>.\n\n- **Cardiovascular:** Persistent tachycardia identified via monitor telemetry. HR sustained above 185 bpm.\n- **Respiratory:** Frequent desaturations. SpO2 trend dropping consistently to 84-86% over the last 3 hours, unresponsive to tactile stimulation.\n- **AI Insights:** The NeoGuard Sepsis Prediction Engine has triggered a **High Risk Alert (88%)**. \n\n**Recommendation for morning team:** Prepare for immediate clinical evaluation. Blood cultures and Golden Hour antibiotic protocol strongly advised.`;
        } else {
            template = `### Shift Summary: ${selectedPtHandoff}\n\nPatient remained <span class="stable">nominally stable</span> throughout the night shift with no acute distress documented.\n\n- **Weight & Nutrition:** Tolerated standard feeds. Daily weight increased by 15g.\n- **Cardiovascular:** HR stabilized in the 135-145 range with normal variability.\n- **Respiratory:** SpO2 remained tightly controlled around 95-97% on room air.\n\n**AI Insights:** Minimal predictive risks flagged by NeoGuard engine. Clear for standard continued care protocols.`;
        }

        let i = 0;
        textContainer.innerHTML = '<span class="typing-cursor"></span>';
        
        function typeWriter() {
            if (i < template.length) {
                // To keep HTML tags intact during typing effect
                if(template.charAt(i) === '<') {
                    let tag = '';
                    while(template.charAt(i) !== '>' && i < template.length) {
                        tag += template.charAt(i);
                        i++;
                    }
                    tag += '>';
                    textContainer.innerHTML = textContainer.innerHTML.replace('<span class="typing-cursor"></span>', '') + tag + '<span class="typing-cursor"></span>';
                } else {
                    textContainer.innerHTML = textContainer.innerHTML.replace('<span class="typing-cursor"></span>', '') + template.charAt(i) + '<span class="typing-cursor"></span>';
                }
                i++;
                setTimeout(typeWriter, 15); // incredibly fast typing effect
            } else {
                textContainer.innerHTML = textContainer.innerHTML.replace('<span class="typing-cursor"></span>', ''); // remove cursor at the end
            }
        }
        typeWriter();
    };

    /* --- Time-Series File Upload Engine --- */
    const dropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');
    const dzContent = document.getElementById('dz-content');
    const dzProcessing = document.getElementById('dz-processing');
    const fillBar = document.getElementById('progress-bar-fill');
    const procStatus = document.getElementById('process-status');
    const nodes = document.querySelectorAll('.status-node');
    const connectors = document.querySelectorAll('.node-connector');

    if(dropzone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
        });

        dropzone.addEventListener('drop', (e) => {
            let dt = e.dataTransfer;
            let files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });

        function handleFiles(files) {
            if(files.length > 0) {
                runPredictionPipeline(files[0]);
            }
        }

        /* === REAL BACKEND INTEGRATION === */
        const API_URL = 'http://127.0.0.1:8000';

        async function runPredictionPipeline(file) {
            // Show processing UI
            dzContent.style.display = 'none';
            dzProcessing.style.display = 'flex';
            dropzone.style.borderColor = 'var(--primary-bright)';
            dropzone.style.background = 'rgba(14, 165, 233, 0.05)';

            // Node 0 – Parsing
            procStatus.textContent = `Reading ${file.name}…`;
            fillBar.style.width = '20%';
            nodes[0].classList.add('active');

            await delay(800);

            // Node 1 – Feature Engineering
            nodes[0].classList.add('completed'); nodes[0].classList.remove('active');
            connectors[0].classList.add('active');
            nodes[1].classList.add('active');
            procStatus.textContent = 'Extracting Time-Series Features (mean, sd, kurtosis)…';
            fillBar.style.width = '55%';

            await delay(800);

            // Node 2 – Model Inference (actual API call)
            nodes[1].classList.add('completed'); nodes[1].classList.remove('active');
            connectors[1].classList.add('active');
            nodes[2].classList.add('active');
            procStatus.textContent = 'Running NeoGuard Ensemble Model…';
            fillBar.style.width = '80%';

            let result = null;
            let errorMsg = null;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(`${API_URL}/predict`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Server error');
                }

                result = await response.json();
            } catch(e) {
                errorMsg = e.message;
                console.error('Backend error:', e);
            }

            // Complete animation
            nodes[2].classList.add('completed'); nodes[2].classList.remove('active');
            fillBar.style.width = '100%';
            procStatus.textContent = errorMsg ? `⚠️ Error: ${errorMsg}` : 'Inference Complete ✓';

            await delay(1000);

            // Reset UI nodes
            dzContent.style.display = 'flex';
            dzProcessing.style.display = 'none';
            fillBar.style.width = '0%';
            nodes.forEach(n => n.classList.remove('completed', 'active'));
            connectors.forEach(c => c.classList.remove('active'));
            nodes[0].classList.add('active');
            dropzone.style.borderColor = '';
            dropzone.style.background = '';

            // Populate patient grid
            if(result) {
                addNewPatientToGrid(result, file.name);
            } else {
                showApiError(errorMsg);
            }
        }

        function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

        function addNewPatientToGrid(apiResult, filename) {
            const patientLabel = filename.replace(/\..+$/, '').replace(/_/g, ' ');
            const pid = 'NICU-AI-' + Date.now();
            const newPatient = {
                id: pid,
                name: `AI: ${patientLabel}`,
                hr:   apiResult.hr_series.length > 0 ? apiResult.hr_series   : [apiResult.hr_mean],
                spo2: apiResult.spo2_series.length > 0 ? apiResult.spo2_series : [apiResult.spo2_mean],
                sepsRsk: apiResult.sepsis_risk_pct,
                critical: apiResult.sepsis_flag,
                aiResult: apiResult
            };

            patients.unshift(newPatient);
            renderPatients();

            // Link to Shift-Handoff module dynamically
            const handoffList = document.getElementById('handoff-patient-list');
            if (handoffList) {
                const div = document.createElement('div');
                div.className = 'pt-select';
                div.onclick = function() { window.selectPatientHandoff(this, newPatient.name); };
                const isHigh = newPatient.critical || newPatient.sepsRsk >= 80;
                div.innerHTML = `
                    <div>
                        <div class="pt-name" style="${isHigh ? 'color:var(--alert-bright);' : ''}">${newPatient.name}</div>
                        <div class="pt-id">${newPatient.id}</div>
                    </div>
                    <i class="ph-bold ph-caret-right"></i>
                `;
                handoffList.prepend(div);
            }

            // Premium Enhancement: Alert History Logging
            if (apiResult.risk_level === 'HIGH' || apiResult.risk_level === 'MODERATE') {
                logAlertHistory(newPatient);
            }

            setTimeout(() => {
                const firstCard = document.querySelector('#patient-grid .p-card:first-child');
                if(firstCard) {
                    firstCard.style.outline = '3px solid var(--primary-bright)';
                    firstCard.style.outlineOffset = '4px';
                    firstCard.style.transform = 'scale(1.02)';
                    setTimeout(() => { firstCard.style.outline = 'none'; firstCard.style.transform = ''; }, 3000);
                }
            }, 100);

            // Show toast AND auto-open the modal
            showRiskToast(apiResult);
            setTimeout(() => openResultsModal(pid), 1200);
        }

        function showRiskToast(apiResult) {
            // Remove any existing toast
            const old = document.getElementById('risk-toast');
            if(old) old.remove();

            const color = apiResult.risk_level === 'HIGH' ? '#f43f5e'
                        : apiResult.risk_level === 'MODERATE' ? '#f59e0b' : '#10b981';
            const icon  = apiResult.risk_level === 'HIGH' ? '🚨' : apiResult.risk_level === 'MODERATE' ? '⚠️' : '✅';

            const toast = document.createElement('div');
            toast.id = 'risk-toast';
            toast.style.cssText = `
                position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
                background: rgba(10,12,20,0.95); border: 1px solid ${color};
                border-radius: 14px; padding: 1.2rem 1.6rem;
                box-shadow: 0 0 30px ${color}44;
                font-family: 'Inter', sans-serif; color: #e2e8f0;
                max-width: 320px; animation: slideIn 0.4s ease;
            `;
            toast.innerHTML = `
                <div style="font-size:1.3rem; margin-bottom:0.4rem;">${icon} <strong style="color:${color}">${apiResult.risk_level} RISK</strong></div>
                <div style="font-size:2rem; font-weight:700; color:${color}">${apiResult.sepsis_risk_pct}%</div>
                <div style="font-size:0.8rem; opacity:0.7;">Sepsis Risk Score</div>
                <div style="font-size:0.78rem; margin-top:0.5rem; opacity:0.6;">HR avg: ${apiResult.hr_mean} bpm | SpO₂ avg: ${apiResult.spo2_mean}%</div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => { if(toast.parentNode) toast.remove(); }, 6000);
        }

        function showApiError(msg) {
            const old = document.getElementById('risk-toast');
            if(old) old.remove();

            const toast = document.createElement('div');
            toast.id = 'risk-toast';
            toast.style.cssText = `
                position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
                background: rgba(10,12,20,0.95); border:1px solid #f43f5e;
                border-radius:14px; padding:1.2rem 1.6rem;
                font-family:'Inter',sans-serif; color:#e2e8f0; max-width:320px;
            `;
            toast.innerHTML = `
                <div style="color:#f43f5e; font-weight:700">⛔ Backend Unreachable</div>
                <div style="font-size:0.8rem; margin-top:0.4rem; opacity:0.7;">${msg}</div>
                <div style="font-size:0.75rem; margin-top:0.6rem; color:#94a3b8;">Make sure the FastAPI server is running:<br><code>uvicorn backend.main:app --reload</code></div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => { if(toast.parentNode) toast.remove(); }, 8000);
        }
    }

    /* ═══════════════════════════════════════
       AI RESULTS MODAL LOGIC
    ═══════════════════════════════════════ */
    window.openResultsModal = function(patientId) {
        const patient = patients.find(p => p.id === patientId);
        if(!patient || !patient.aiResult) return;
        const r = patient.aiResult;

        document.getElementById('air-patient-name').textContent = patient.name;

        // Risk level colors
        const isHigh = r.risk_level === 'HIGH';
        const isMod  = r.risk_level === 'MODERATE';
        const clr    = isHigh ? 'var(--alert-bright)' : isMod ? 'var(--warning-bright)' : 'var(--accent-bright)';
        const arcClr = isHigh ? '#f43f5e' : isMod ? '#f59e0b' : '#10b981';
        const gaugeClass = isHigh ? 'gauge-high' : isMod ? 'gauge-mod' : 'gauge-low';

        const pct = document.getElementById('air-risk-pct');
        const lbl = document.getElementById('air-risk-label');
        pct.textContent = r.sepsis_risk_pct + '%';
        pct.className = 'gauge-value ' + gaugeClass;
        lbl.textContent = r.risk_level + ' RISK';
        lbl.className = 'gauge-label ' + gaugeClass;

        // Animate gauge arc
        const arc = document.getElementById('gauge-arc');
        arc.setAttribute('stroke', arcClr);
        const totalLen = 283; // half-circle arc length for viewBox 200x120
        const fill = (r.sepsis_risk_pct / 100) * totalLen;
        arc.style.strokeDashoffset = totalLen; // reset
        arc.style.transition = 'none';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
                arc.style.strokeDashoffset = totalLen - fill;
            });
        });

        // Animate needle (-90deg = 0%, +90deg = 100%)
        const needle = document.getElementById('gauge-needle');
        const angle  = -90 + (r.sepsis_risk_pct / 100) * 180;
        needle.style.transform = `rotate(${angle}deg)`;

        // Explanation
        const expEl = document.getElementById('air-explanation');
        // Replace **bold** markdown with HTML
        const expHtml = r.explanation_summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        expEl.innerHTML = `<i class="ph-fill ph-info" style="color:var(--primary-bright);flex-shrink:0;margin-top:2px;"></i><span>${expHtml}</span>`;

        // Recommendations
        const recList = document.getElementById('rec-list');
        const recCont = document.getElementById('air-recs');
        recCont.className = 'air-recommendations risk-' + r.risk_level;
        recList.innerHTML = r.recommendations.map(rec => `<li>${rec}</li>`).join('');

        // Feature bars
        const barsContainer = document.getElementById('feat-bars-container');
        barsContainer.innerHTML = '';
        // Sort by absolute attribution descending
        const sorted = [...r.feature_details].sort((a,b) => Math.abs(b.attribution) - Math.abs(a.attribution));
        sorted.forEach(feat => {
            const isPos = feat.attribution >= 0;
            const barWidth = Math.abs(feat.attribution) * 50; // max 50% of track
            const valStr = feat.unit ? `${feat.value} ${feat.unit}` : feat.value.toFixed(2);
            const valColor = feat.is_abnormal ? 'var(--alert-bright)' : 'var(--text-muted)';

            const row = document.createElement('div');
            row.className = 'feat-bar-row';
            row.innerHTML = `
                <div class="feat-bar-label" title="${feat.label}">
                    ${feat.is_abnormal ? '<span class="feat-abnormal-dot"></span>' : ''}
                    ${feat.label}
                </div>
                <div class="feat-bar-track">
                    <div class="feat-bar-fill ${isPos ? 'pos' : 'neg'}" style="width:0%"></div>
                </div>
                <div class="feat-bar-value" style="color:${valColor}">${valStr}</div>
            `;
            barsContainer.appendChild(row);

            // Animate bar after DOM insert
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const fill = row.querySelector('.feat-bar-fill');
                    if(fill) fill.style.width = barWidth + '%';
                });
            });
        });

        // Setup Feature 1: Digital Twin Defaults
        const sliderHr = document.getElementById('twin-hr');
        const sliderSpo2 = document.getElementById('twin-spo2');
        if(sliderHr && sliderSpo2) {
            sliderHr.value = Math.round(r.hr_mean);
            sliderSpo2.value = Math.round(r.spo2_mean);
            document.getElementById('twin-hr-val').textContent = sliderHr.value;
            document.getElementById('twin-spo2-val').textContent = sliderSpo2.value;
            window.currentPatientContext = r; // store for twin
        }

        // Setup Feature 4: Patient Journey Context
        if(window.initPatientJourneyChart) {
            window.initPatientJourneyChart(r);
        }

        // Setup Feature 2: Update Ward Map
        if(window.updateWardMap) {
            window.updateWardMap(patientId, r.risk_level);
        }

        // Show modal
        document.getElementById('ai-results-modal').classList.add('active');
    };

    window.closeResultsModal = function() {
        document.getElementById('ai-results-modal').classList.remove('active');
    };

    // Close on backdrop click
    document.getElementById('ai-results-modal').addEventListener('click', function(e) {
        if(e.target === this) closeResultsModal();
    });

    /* ═══════════════════════════════════════
       MODEL INTELLIGENCE LOGIC
    ═══════════════════════════════════════ */
    let miAnimated = false;
    window.animateModelIntelligence = function() {
        if(miAnimated) return;
        miAnimated = true;

        // Animate quick stats & efficiency stats
        const animatedVals = document.querySelectorAll('.mi-qs-val, .eff-val[data-target]');
        animatedVals.forEach(el => {
            const targetRaw = el.getAttribute('data-target');
            if(!targetRaw) return;
            const target = parseFloat(targetRaw);
            const special = el.getAttribute('data-special');
            if (special === 'zero-fp') return; // static text handle

            let current = 0;
            const increment = target / 40; // ~40 frames
            const isSmallDecimal = target < 1;
            const isLargeDecimal = target > 1 && target % 1 !== 0;

            const timer = setInterval(() => {
                current += increment;
                if(current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                
                if(isSmallDecimal) el.textContent = current.toFixed(4);
                else if(isLargeDecimal) el.textContent = current.toFixed(2);
                else el.textContent = Math.floor(current).toLocaleString();
                
            }, 30);
        });
    };

    /* ═══════════════════════════════════════
       PREMIUM ENHANCEMENTS
    ═══════════════════════════════════════ */

    // 1. PDF Report Export
    window.downloadAnalysisPDF = function() {
        const element = document.getElementById('ai-results-panel');
        element.classList.add('pdf-export-mode'); // optional css overrides for printing
        const opt = {
            margin:       0.5,
            filename:     'NeoGuard-Sepsis-Analysis.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save().then(() => {
            element.classList.remove('pdf-export-mode');
        });
    };

    // 2. Alert History Logging
    let alertCount = 0;
    window.logAlertHistory = function(patient) {
        const panel = document.getElementById('alert-history-panel');
        const list = document.getElementById('alert-history-list');
        const empty = list.querySelector('.empty-alerts');
        if(empty) empty.style.display = 'none';
        
        panel.style.display = 'flex'; // show if hidden

        const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        const item = document.createElement('div');
        item.className = 'alert-item';
        item.innerHTML = `
            <div class="alert-item-time"><i class="ph-bold ph-clock"></i> ${timeStr} | ID: ${patient.id.slice(-6)}</div>
            <div class="alert-item-title">
                <span>${patient.name}</span>
                <span class="alert-item-pct" style="color: ${patient.critical ? 'var(--alert-bright)' : 'var(--warning-bright)'}">${patient.sepsRsk}%</span>
            </div>
        `;
        list.prepend(item);

        alertCount++;
        if(alertCount > 10) {
            list.removeChild(list.lastChild);
        }
    };

    // 3. Interactive Walkthrough Tour
    let tourStep = 0;
    const tourSteps = [
        { title: "Command Hub", text: "Welcome to NeoGuard AI. This is your central view of all machine learning modules monitoring the NICU.", target: 'dashboard-hub' },
        { title: "Sepsis Telemetry", text: "Drag and drop patient CSV files here to run our Deep XGBoost/LSTM model and visualize real-time risks.", target: 'live-monitor' },
        { title: "Alert History", text: "Crucial sepsis alerts will pile up securely down here so you don't miss a beat.", target: null },
        { title: "Model Intelligence", text: "Dive deep into the architecture, ROC curves, and parameters of our powerful AI models.", target: 'model-intelligence' },
        { title: "You're Set!", text: "Let's save lives together.", target: null }
    ];

    window.startTour = function() {
        tourStep = 0;
        document.getElementById('tour-overlay').classList.add('active');
        document.getElementById('tour-box').classList.add('active');
        showTourStep(tourStep);
    };

    window.endTour = function() {
        document.getElementById('tour-overlay').classList.remove('active');
        document.getElementById('tour-box').classList.remove('active');
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    };

    window.nextTourStep = function() {
        tourStep++;
        if (tourStep >= tourSteps.length) {
            endTour();
        } else {
            showTourStep(tourStep);
        }
    };

    function showTourStep(index) {
        const step = tourSteps[index];
        document.getElementById('tour-title').innerHTML = `<i class="ph-bold ph-info"></i> ${step.title}`;
        document.getElementById('tour-content').textContent = step.text;
        
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

        if(step.target) {
            window.switchView(step.target);
            const targetEl = document.getElementById(step.target) || document.querySelector(`[data-target="${step.target}"]`);
            if (targetEl) {
                targetEl.classList.add('tour-highlight');
                const rect = targetEl.getBoundingClientRect();
                const box = document.getElementById('tour-box');
                box.style.top = Math.max(20, (rect.top + (rect.height/2) - 100)) + 'px';
                box.style.left = Math.min(window.innerWidth - 350, rect.right + 30) + 'px';
            }
        } else {
            const box = document.getElementById('tour-box');
            box.style.top = '50%';
            box.style.left = '50%';
            box.style.transform = 'translate(-50%, -50%)';
        }

        if(index === tourSteps.length - 1) {
            document.querySelector('.btn-tour-next').innerHTML = 'Finish <i class="ph-bold ph-check"></i>';
        } else {
            document.querySelector('.btn-tour-next').innerHTML = 'Next <i class="ph-bold ph-arrow-right"></i>';
        }
    }

    // 4. Live ECG Waveform Animation Canvas
    const initEcgBackground = () => {
        const canvas = document.getElementById('ecg-bg');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        let px = 0;
        let py = height / 2;
        ctx.strokeStyle = '#2dd4bf'; // Accent bright
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        let phase = 0;
        const draw = () => {
            // Very slight fade for trailing effect
            ctx.fillStyle = 'rgba(2, 6, 23, 0.05)';
            ctx.fillRect(0, 0, width, height);

            ctx.beginPath();
            ctx.moveTo(px, py);

            px += 3; // Speed

            let nextY = height / 2;
            
            // Generate ECG shape based on time/phase
            phase++;
            const t = phase % 250;
            if(t > 100 && t < 105) nextY -= 15;        // P wave
            else if(t > 115 && t < 120) nextY += 10;   // Q
            else if(t > 120 && t < 125) nextY -= 120;  // R (spike up)
            else if(t > 125 && t < 130) nextY += 40;   // S (spike down)
            else if(t > 150 && t < 165) nextY -= 20;   // T wave
            
            // Adding a little random baseline wander
            nextY += (Math.random() - 0.5) * 2;

            ctx.lineTo(px, nextY);
            ctx.stroke();

            py = nextY;

            if (px > width) {
                px = 0;
                // Optional: clear to keep it perfectly clean like a real monitor
                ctx.clearRect(0, 0, width, height); 
            }

            requestAnimationFrame(draw);
        };
        draw();
    };

    // Starts it all
    initEcgBackground();

    /* ═══════════════════════════════════════
       5. HOSPITAL GRADE ENHANCEMENTS
    ═══════════════════════════════════════ */

    // Feature 1: Digital Twin Simulation
    let twinTimer = null;
    window.simulateTwin = function() {
        clearTimeout(twinTimer);
        const hr = parseFloat(document.getElementById('twin-hr').value);
        const spo2 = parseFloat(document.getElementById('twin-spo2').value);
        const ctx = window.currentPatientContext;
        if(!ctx) return;
        
        let reqFeatures = {};
        ctx.feature_details.forEach(f => reqFeatures[f.name] = f.value);
        reqFeatures['mean_hr'] = hr;
        reqFeatures['mean_spo2'] = spo2;

        twinTimer = setTimeout(() => {
            fetch('http://127.0.0.1:8000/simulate_twin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ features: reqFeatures })
            })
            .then(res => res.json())
            .then(data => {
                // Update UI Gauge
                const isHigh = data.risk_level === 'HIGH';
                const isMod  = data.risk_level === 'MODERATE';
                const gaugeClass = isHigh ? 'gauge-high' : isMod ? 'gauge-mod' : 'gauge-low';
                const arcClr = isHigh ? '#f43f5e' : isMod ? '#f59e0b' : '#10b981';
                
                const pct = document.getElementById('air-risk-pct');
                const lbl = document.getElementById('air-risk-label');
                pct.textContent = data.sepsis_risk_pct + '%';
                pct.className = 'gauge-value ' + gaugeClass;
                lbl.textContent = data.risk_level + ' RISK (SIMULATED)';
                lbl.className = 'gauge-label ' + gaugeClass;

                const arc = document.getElementById('gauge-arc');
                arc.setAttribute('stroke', arcClr);
                const fill = (data.sepsis_risk_pct / 100) * 283;
                arc.style.strokeDashoffset = 283 - fill;

                // Update Recs
                const recList = document.getElementById('rec-list');
                recList.innerHTML = `<li style="color:var(--text-muted); font-style:italic">Showing simulated recommendations based on overrides.</li>`;
                data.recommendations.forEach(r => {
                    const li = document.createElement('li');
                    li.textContent = r;
                    recList.appendChild(li);
                });
            })
            .catch(e => console.error(e));
        }, 300);
    };

    // Feature 2: 3D Ward Map Generator
    const bedStates = {};
    function initWardMap() {
        const grid = document.getElementById('ward-grid');
        if(!grid) return;
        for(let i=1; i<=12; i++) {
            const div = document.createElement('div');
            div.className = 'incubator-node';
            div.id = 'bed-' + i;
            div.dataset.risk = 'low';
            div.innerHTML = `
                <div class="bed-title"><i class="ph-fill ph-baby"></i> INCUBATOR #${i}</div>
                <div class="bed-status">Status: Stable</div>
                <div class="bed-parent" style="color:var(--text-muted);font-size:0.8rem;margin-top:0.3rem">Unassigned</div>
                <div class="bed-glow"></div>
            `;
            grid.appendChild(div);
            bedStates[i] = div;
        }
    }
    initWardMap();

    window.updateWardMap = function(patientId, risk_level) {
        // Assign to a random bed for demo purposes
        const b = Math.floor(Math.random() * 12) + 1; 
        const bed = bedStates[b];
        if(!bed) return;
        bed.dataset.risk = risk_level.toLowerCase();
        bed.querySelector('.bed-status').textContent = 'Condition: ' + risk_level;
        bed.querySelector('.bed-parent').textContent = 'ID: ' + patientId.slice(-4);
    };

    // Feature 3: Patient Journey Rendering
    window.initPatientJourneyChart = function(result) {
        const canvas = document.getElementById('journey-chart');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.parentElement.clientWidth || 300;
        const H = canvas.height = canvas.parentElement.clientHeight || 120;
        
        ctx.clearRect(0,0,W,H);
        
        const currentRisk = result.sepsis_risk_pct;
        const points = [];
        let risk = Math.max(5, currentRisk * 0.1);
        for(let i=0; i<8; i++) {
            points.push(risk);
            risk += (currentRisk - risk) * 0.3 + (Math.random() - 0.2) * 5; 
        }
        points.push(currentRisk);

        ctx.beginPath();
        const step = W / (points.length - 1);
        ctx.moveTo(0, H - (points[0]/100)*H);
        for(let i=1; i<points.length; i++) {
            ctx.lineTo(i * step, H - (points[i]/100)*H);
        }
        
        ctx.strokeStyle = result.risk_level === 'HIGH' ? '#f43f5e' : (result.risk_level==='MODERATE'? '#f59e0b': '#10b981');
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0, ctx.strokeStyle + '66');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
    };

    // Feature 4: Voice Assistant
    let recognition;
    let isListening = false;
    window.toggleVoice = function() {
        const btn = document.getElementById('btn-voice');
        if(isListening) {
            if(recognition) recognition.stop();
            return;
        }
        
        // Use either webkit prefix or standard (Chrome uses webkitSpeechRecognition)
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(!SpeechRec) {
            alert('Speech Recognition not natively supported in this browser. Please use Chrome/Edge.');
            return;
        }
        
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
            isListening = true;
            btn.classList.add('btn-voice-active');
            btn.innerHTML = '<i class="ph-fill ph-waveform"></i> Listening...';
        };

        recognition.onresult = function(event) {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
            console.log("🗣️ Command Heard:", transcript);
            
            if(transcript.includes('open map') || transcript.includes('ward') || transcript.includes('floorplan')) {
                window.switchView('ward-map');
            } else if(transcript.includes('open telemetry') || transcript.includes('sepsis')) {
                window.switchView('live-monitor');
            } else if(transcript.includes('hub') || transcript.includes('home')) {
                window.switchView('dashboard-hub');
            } else if(transcript.includes('clear alerts')) {
                const list = document.getElementById('alert-history-list');
                if(list) list.innerHTML = '<div class="empty-alerts">No alerts recorded yet.</div>';
                document.getElementById('alert-history-panel').style.display = 'none';
            } else if(transcript.includes('export report') || transcript.includes('download pdf')) {
                if(document.getElementById('ai-results-modal').classList.contains('active')) {
                    window.downloadAnalysisPDF();
                }
            } else if(transcript.includes('close') || transcript.includes('acknowledge')) {
                window.closeResultsModal();
            }
        };

        recognition.onerror = function(e) {
            console.error("Voice Error:", e.error);
        };

        recognition.onend = function() {
            isListening = false;
            btn.classList.remove('btn-voice-active');
            btn.innerHTML = '<i class="ph-fill ph-microphone"></i> Voice Assist';
        };

        recognition.start();
    };

});
