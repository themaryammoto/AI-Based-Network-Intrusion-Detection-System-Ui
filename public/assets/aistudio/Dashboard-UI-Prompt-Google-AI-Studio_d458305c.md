# NIDS Dashboard UI — Google AI Studio Prompt (Complete A to Z)

Copy-paste this full prompt into Google AI Studio > Build.

---

Build a complete, professional, production-ready web dashboard app called **"Sentinel AI — Network Intrusion Detection Dashboard"** for my Final Year Project: AI-Based Network Intrusion Detection Pipeline.

## 1. Project Context (use these REAL numbers, do not invent different totals)
- Dataset: CIC-IDS2017, collected 3–7 July 2017, Monday to Friday, 9 AM to 5 PM.
- Total flows: 2,830,743 — BENIGN: 2,273,097 (80.3%), Attack: 557,646 (19.7%)
- Features: 78 features + Label = 79 columns. 8 CSV files, one per day/time slot.
- Per-day attacks:
  - Monday: BENIGN only, 529,918 flows, no attacks
  - Tuesday: FTP-Patator, SSH-Patator (brute force)
  - Wednesday: DoS Hulk, DoS GoldenEye, DoS slowloris, DoS Slowhttptest, Heartbleed (11 flows)
  - Thursday: Web Attack Brute Force, XSS, SQL Injection, Infiltration (36 flows)
  - Friday: Bot, PortScan, DDoS
- Models to show: Logistic Regression, Decision Tree, Random Forest, XGBoost (best), MLP, LSTM, Isolation Forest, Autoencoder
- Target metrics: Attack Recall >= 95%, Overall F1 >= 0.95, False Positive Rate < 2%, Alert latency < 5 seconds
- Pipeline stages: 1. Data Acquisition, 2. Preprocessing, 3. Feature Engineering, 4. Model Training, 5. Evaluation, 6. Live Deployment + Alerting
- Lab tools: nmap (PortScan), hping3 (DoS/DDoS), Hydra (SSH/FTP brute force), sqlmap (web attacks), Wireshark / Zeek / Suricata for capture

## 2. Overall Design — Professional SOC Style
- Modern Security Operations Center (SOC) dashboard, clean, trustworthy, not playful, no emojis in UI.
- Layout: Fixed dark left sidebar (240px) + top header bar + main content area. Fully responsive — sidebar collapses to icons on tablet and to a hamburger menu on mobile.
- Font: Inter for all text. Headings semibold, numbers tabular and bold.
- Professional color palette — use EXACTLY these:
  - Primary Navy: #0F2A44
  - Dark Sidebar / Header: #0B1B2B
  - Page Background: #F1F5F9
  - Card Background: #FFFFFF
  - Border: #E2E8F0
  - Primary Text: #0F172A
  - Secondary Text: #64748B
  - Accent Blue: #2563EB
  - Accent Teal/Cyan: #0891B2
  - Success / BENIGN / Safe: #059669
  - Warning / Medium: #D97706
  - Danger / Critical Attack: #DC2626
  - High Severity: #EA580C
  - Chart colors: #2563EB, #0891B2, #059669, #D97706, #DC2626, #7C3AED
- Cards: white, 12px border-radius, 1px light border, soft shadow, 16-20px padding.
- Buttons: Primary navy/blue filled, secondary white with border, danger red only for critical actions.
- Status pills: green for BENIGN/Safe, red for Critical, orange for High, amber for Medium, blue for Low/Info.
- All charts must be real interactive charts (line, bar, donut, area), not static images.

## 3. Navigation — Sidebar Menu (all pages must work)
1. Overview / Dashboard
2. Live Traffic Monitor
3. Alerts Center
4. Attack Analysis
5. Model Performance
6. Dataset Explorer
7. Lab Simulation
8. Reports
9. Settings

Top header on every page: Search bar (search by IP, attack type, alert ID), Live status badge "● LIVE — Monitoring", time-range selector (Last 1h / 6h / 24h / 7 days), date, notification bell with count, user avatar "Maryam Tahir — Security Analyst".

## 4. Page 1 — Overview / Dashboard (Home)
Top row — 4 KPI cards with small trend arrows and sparkline:
- Total Flows Analyzed: 2,830,743
- Attacks Detected: 557,646 (19.7%)
- BENIGN Traffic: 2,273,097 (80.3%)
- False Positive Rate: 1.8% (Target < 2%)
Second row:
- Large Area/Line Chart: "Traffic Over Time — BENIGN vs Attack" for Mon-Fri, with legend and hover tooltip.
- Donut Chart: "Attack Type Distribution" — DoS, PortScan, Brute Force, Web Attack, Bot, DDoS, Infiltration, Heartbleed.
Third row:
- Bar Chart: "Attacks by Day (Tue-Fri)" and "Top 5 Source IPs" table.
- "Recent Critical Alerts" table: Time, Alert ID, Attack Type, Source IP, Destination IP, Severity, Status (New / Investigating / Resolved).
- "System Health" card: Model: XGBoost (Active), Status: Online, Latency: 2.4s, Uptime: 99.9%, GPU: Tesla T4.

## 5. Page 2 — Live Traffic Monitor
- Big live line chart updating every 2 seconds (simulated live data), showing packets/sec and flows/sec.
- Live feed table auto-updating: Timestamp, Source IP, Destination IP, Protocol, Flow Duration, Packets, Bytes, Prediction (BENIGN / ATTACK), Confidence %.
- Controls: Pause / Resume Live button, Filter by Prediction (All / BENIGN / Attack), Filter by Protocol (TCP / UDP / ICMP).
- Attack traffic rows highlighted in light red, BENIGN rows in light green.
- Small stats: Current Threat Level gauge (Low / Medium / High), Active Connections, Blocked Attempts Today.

## 6. Page 3 — Alerts Center
- Summary chips: Total Alerts, Critical, High, Medium, Low, Resolved.
- Filter bar: Severity, Attack Type, Status, Date, Search.
- Full alerts table with 15+ realistic sample alerts, sortable columns.
- Each row expands on click to show full detail: Flow features (Flow Duration, Total Packets, Packet Length, Flow Bytes/s), Model Confidence, Recommended Action.
- Action buttons per alert: Acknowledge, Mark Resolved, Export.
- Bulk action: "Acknowledge All" and "Export CSV".

## 7. Page 4 — Attack Analysis
- Attack type cards for PortScan, DoS/DDoS, Brute Force, Web Attack (SQLi/XSS), Bot, Infiltration — each with icon, count, % share, trend.
- Charts: Attack Timeline, Attack by Hour heatmap, Top Attacker IPs bar chart, Target Ports bar chart (22 SSH, 21 FTP, 80 HTTP, 443 HTTPS).
- Clicking an attack type filters all charts and tables on this page to that type.

## 8. Page 5 — Model Performance
- Model comparison table: Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC | False Positive Rate | Inference Time
  - Logistic Regression, Decision Tree, Random Forest, XGBoost (highlight as Best Model with badge), MLP, LSTM
  - XGBoost values: Accuracy 99.2%, Precision 98.7%, Recall 98.9%, F1 0.988, ROC-AUC 0.994, FPR 1.8%
- Confusion Matrix visual for XGBoost: TP, TN, FP, FN with numbers and colors.
- ROC Curve chart and Precision-Recall chart.
- Feature Importance horizontal bar chart: Top 10 features — Flow Duration, Total Fwd Packets, Flow Bytes/s, Flow Packets/s, Init_Win_bytes_forward, etc.
- Note box: "Recall is the primary metric because a missed attack is more costly than a false alarm."

## 9. Page 6 — Dataset Explorer
- Dataset summary cards: 8 Files, 2,830,743 Rows, 79 Columns, 241 MB, Date Range 3–7 July 2017.
- File table: File Name (Monday-WorkingHours, Tuesday-WorkingHours, Wednesday-WorkingHours, Thursday-WorkingHours-Morning, Thursday-WorkingHours-Afternoon, Friday-WorkingHours-Morning, Friday-WorkingHours-Afternoon, Friday-WorkingHours) | Rows | BENIGN | Attack | Attack Types.
- Class imbalance visual: BENIGN 80.3% vs Attack 19.7% bar.
- Preprocessing checklist with checkmarks: Remove Duplicates, Remove NaN / Infinite Values, Strip Column Spaces (df.columns.str.strip()), Encode Labels, StandardScaler (fit on train only), Train/Test Split 80/20 (no leakage), SMOTE / Class Weight for imbalance.

## 10. Page 7 — Lab Simulation
- Lab topology diagram: Attacker VM → Firewall / Sensor (Zeek/Suricata) → Target VM → Sentinel AI Model → Dashboard.
- Buttons to simulate attacks (simulated only, safe demo): "Run PortScan (nmap)", "Run DoS Flood (hping3)", "Run SSH Brute Force (Hydra)", "Run Web Attack (sqlmap)".
- When a button is clicked: show a live log terminal, then after 2–4 seconds a new alert appears in the feed with correct attack type, severity, and "Detected in 2.4s" message.
- Show detection result card after each simulation.

## 11. Page 8 — Reports
- Report cards: Daily Summary, Weekly Model Report, Attack Trend Report, False Positive Analysis.
- Each report: Generate button, Preview, Download PDF / CSV button (simulated download).
- Date picker and Export options.

## 12. Page 9 — Settings
- Model selection dropdown (XGBoost default), Confidence Threshold slider (default 0.80), Alert Sensitivity (Low/Medium/High), Email Alerts toggle, Sound Alert toggle, Theme toggle (Light/Dark), Refresh Interval selector.
- Save button with "Settings Saved" confirmation toast.

## 13. Interactions & Behavior (Very Important)
- Every sidebar link must switch pages without reload. Every filter, search, and button must actually work and update the tables/charts.
- Live pages update automatically every 2 seconds with new simulated rows.
- All charts have hover tooltips, legends, and clickable segments.
- Show toast notifications for actions: "Alert Acknowledged", "Report Exported", "Settings Saved".
- Empty state: If a filter returns no result, show "No alerts found for this filter" — never show a blank page.
- Loading state: Show a short skeleton loader when switching pages.

## 14. Data Rules
- Use the real CIC-IDS2017 numbers above for totals and per-day breakdown. For live feed and individual alert rows, use realistic sample data (realistic IPs like 192.168.10.5, 172.16.0.1, ports, timestamps) and label it as sample/demo data in a small footer note: "Demo data based on CIC-IDS2017 for Final Year Project presentation."
- Do NOT invent a different dataset total or claim real-time connection to a real network. This is a frontend demo dashboard for a university project.

## 15. Quality Checklist
- Professional, clean, consistent spacing and alignment on every page.
- No lorem ipsum, no placeholder text, no broken images, no dead buttons.
- All text in clear English, correct spelling.
- Works on desktop, tablet, and mobile.
- Final output must be a complete working app, not just a mockup image.

Build the full app now with all 9 pages, all charts, tables, filters, and live simulation working.
