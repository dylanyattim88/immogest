import { useState, useEffect } from "react";

const STORAGE_KEY = "immogest_data_v3";

const defaultData = {
  apartments: [
    { id: 1, name: "Apt 101", address: "12 Rue de la Paix", city: "Paris", zip: "75001", surface: 45, rooms: 2, rent: 1200, charges: 150, status: "loue", type: "appartement", floor: 1, description: "" },
    { id: 2, name: "Apt 202", address: "8 Avenue Montaigne", city: "Paris", zip: "75008", surface: 72, rooms: 3, rent: 2100, charges: 200, status: "loue", type: "appartement", floor: 2, description: "" },
    { id: 3, name: "Apt 305", address: "3 Rue du Faubourg", city: "Lyon", zip: "69001", surface: 30, rooms: 1, rent: 650, charges: 80, status: "vacant", type: "studio", floor: 3, description: "" },
    { id: 4, name: "Apt 410", address: "21 Boulevard Victor Hugo", city: "Nice", zip: "06000", surface: 60, rooms: 3, rent: 1450, charges: 120, status: "loue", type: "appartement", floor: 4, description: "" },
  ],
  tenants: [
    { id: 1, name: "Marie Dupont", email: "marie.dupont@email.fr", phone: "06 12 34 56 78", apartmentId: 1, leaseStart: "2024-01-01", leaseEnd: "2024-12-31", deposit: 2400, notes: "" },
    { id: 2, name: "Thomas Bernard", email: "thomas.b@email.fr", phone: "07 98 76 54 32", apartmentId: 2, leaseStart: "2023-09-01", leaseEnd: "2025-08-31", deposit: 4200, notes: "" },
    { id: 3, name: "Isabelle Martin", email: "i.martin@email.fr", phone: "06 55 44 33 22", apartmentId: 4, leaseStart: "2024-03-15", leaseEnd: "2025-03-14", deposit: 2900, notes: "" },
  ],
  payments: [
    { id: 1, tenantId: 1, apartmentId: 1, amount: 1350, date: "2026-05-01", type: "Loyer + charges", status: "paye", method: "virement", reference: "VIR-2026-05-001" },
    { id: 2, tenantId: 2, apartmentId: 2, amount: 2300, date: "2026-05-03", type: "Loyer + charges", status: "paye", method: "virement", reference: "VIR-2026-05-002" },
    { id: 3, tenantId: 3, apartmentId: 4, amount: 1570, date: "2026-05-01", type: "Loyer + charges", status: "en retard", method: "", reference: "" },
    { id: 4, tenantId: 1, apartmentId: 1, amount: 1350, date: "2026-04-01", type: "Loyer + charges", status: "paye", method: "virement", reference: "VIR-2026-04-001" },
    { id: 5, tenantId: 2, apartmentId: 2, amount: 2300, date: "2026-04-02", type: "Loyer + charges", status: "paye", method: "virement", reference: "VIR-2026-04-002" },
    { id: 6, tenantId: 3, apartmentId: 4, amount: 1570, date: "2026-04-01", type: "Loyer + charges", status: "paye", method: "especes", reference: "ESP-2026-04-001" },
  ],
  maintenances: [
    { id: 1, apartmentId: 1, description: "Fuite robinet cuisine", date: "2026-05-10", status: "en cours", priority: "haute", cost: 150, provider: "Plomberie Martin", notes: "" },
    { id: 2, apartmentId: 2, description: "Remplacement chauffe-eau", date: "2026-04-20", status: "termine", priority: "urgente", cost: 800, provider: "Electro Services", notes: "" },
    { id: 3, apartmentId: 4, description: "Peinture salon", date: "2026-05-18", status: "planifie", priority: "basse", cost: 400, provider: "", notes: "" },
  ],
  owner: {
    name: "Jean Proprietaire",
    address: "15 Rue des Lilas",
    city: "Paris",
    zip: "75010",
    email: "jean.proprio@email.fr",
    phone: "06 00 00 00 00",
    siret: "",
  },
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return defaultData;
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

const fmt = (n) => Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "-";
const monthName = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #f4f6f9;
  --white: #ffffff;
  --border: #e2e8f0;
  --border2: #cbd5e1;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-light: #eff6ff;
  --accent-light2: #dbeafe;
  --green: #16a34a;
  --green-light: #f0fdf4;
  --green-light2: #dcfce7;
  --red: #dc2626;
  --red-light: #fef2f2;
  --red-light2: #fecaca;
  --amber: #d97706;
  --amber-light: #fffbeb;
  --amber-light2: #fde68a;
  --t1: #0f172a;
  --t2: #334155;
  --t3: #64748b;
  --t4: #94a3b8;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05);
  --r: 8px;
  --r2: 12px;
}

body {
  background: var(--bg);
  color: var(--t1);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

.app { display: flex; min-height: 100vh; }

/* ── Sidebar ── */
.sidebar {
  width: 230px;
  background: var(--t1);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
}

.sidebar-brand {
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  width: 34px; height: 34px;
  background: var(--accent);
  border-radius: var(--r);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.brand-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
}
.brand-version {
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  margin-top: 2px;
  letter-spacing: 0.5px;
}

.nav-group {
  padding: 12px 12px 4px;
}
.nav-group-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 8px;
  margin-bottom: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--r);
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  margin-bottom: 1px;
  position: relative;
}
.nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
.nav-item.active { background: var(--accent); color: #fff; }
.nav-icon { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
.nav-badge {
  margin-left: auto;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.sidebar-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sidebar-stat {
  background: rgba(255,255,255,0.06);
  border-radius: var(--r);
  padding: 10px;
  text-align: center;
}
.sidebar-stat-val { font-size: 20px; font-weight: 700; color: #fff; }
.sidebar-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }

/* ── Main ── */
.main { margin-left: 230px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }

.topbar {
  background: var(--white);
  border-bottom: 1px solid var(--border);
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 28px;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: var(--shadow-sm);
}
.topbar-title { font-size: 16px; font-weight: 700; color: var(--t1); }
.topbar-sep { color: var(--border2); }
.topbar-sub { font-size: 13px; color: var(--t3); }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.topbar-date {
  font-size: 12px;
  color: var(--t3);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 6px;
}

.content { padding: 24px 28px; flex: 1; }

/* ── Alerts ── */
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: var(--r);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
  border: 1px solid;
}
.alert-red { background: var(--red-light); color: var(--red); border-color: var(--red-light2); }
.alert-amber { background: var(--amber-light); color: var(--amber); border-color: var(--amber-light2); }

/* ── Stat cards ── */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  padding: 18px 20px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.stat-label { font-size: 12px; font-weight: 600; color: var(--t3); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-icon-wrap {
  width: 36px; height: 36px;
  border-radius: var(--r);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.stat-value { font-size: 26px; font-weight: 700; color: var(--t1); letter-spacing: -0.5px; line-height: 1; }
.stat-delta { font-size: 12px; color: var(--t3); margin-top: 4px; }
.stat-delta.green { color: var(--green); }
.stat-delta.red { color: var(--red); }

/* ── Cards ── */
.card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  margin-bottom: 16px;
}
.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--white);
}
.card-title { font-size: 14px; font-weight: 700; color: var(--t1); }
.card-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 20px;
}
.card-actions { margin-left: auto; }

/* ── Table ── */
table { width: 100%; border-collapse: collapse; }
th {
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  background: #fafbfc;
  white-space: nowrap;
}
td {
  padding: 13px 20px;
  font-size: 13px;
  color: var(--t2);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafbff; }
.td-primary { color: var(--t1) !important; font-weight: 600; }
.td-mono { font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px !important; }

/* ── Badges ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.bg { background: var(--green-light2); color: var(--green); }
.bg::before { background: var(--green); }
.br { background: var(--red-light2); color: var(--red); }
.br::before { background: var(--red); }
.ba { background: var(--amber-light2); color: var(--amber); }
.ba::before { background: var(--amber); }
.bb { background: var(--accent-light2); color: var(--accent); }
.bb::before { background: var(--accent); }
.bn { background: var(--bg); color: var(--t3); border: 1px solid var(--border); }
.bn::before { background: var(--t4); }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: 'Inter', sans-serif;
  transition: all 0.15s;
  white-space: nowrap;
  line-height: 1;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-ghost { background: var(--white); color: var(--t2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--bg); border-color: var(--border2); color: var(--t1); }
.btn-danger { background: var(--red-light); color: var(--red); border: 1px solid var(--red-light2); }
.btn-danger:hover { background: var(--red-light2); }
.btn-success { background: var(--green-light); color: var(--green); border: 1px solid var(--green-light2); }
.btn-sm { padding: 5px 10px; font-size: 12px; }

/* ── Grid ── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* ── Modal ── */
.overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  padding: 28px;
  width: 560px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
  box-shadow: var(--shadow-lg);
}
.modal-lg { width: 700px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.modal-title { font-size: 18px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
.modal-sub { font-size: 13px; color: var(--t3); margin-bottom: 22px; }
.modal-divider { height: 1px; background: var(--border); margin: 20px 0; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }

/* ── Form ── */
.form-group { margin-bottom: 14px; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--t2); margin-bottom: 5px; }
.form-input {
  width: 100%;
  background: var(--white);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  padding: 9px 12px;
  color: var(--t1);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
select.form-input { cursor: pointer; }
textarea.form-input { resize: vertical; min-height: 70px; }

/* ── Ring ── */
.ring-wrap { position: relative; display: inline-block; }
.ring-svg { transform: rotate(-90deg); display: block; }
.ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.ring-pct { font-size: 18px; font-weight: 700; color: var(--t1); line-height: 1; }
.ring-lbl { font-size: 9px; font-weight: 600; color: var(--t3); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

/* ── Progress ── */
.progress { background: var(--border); border-radius: 4px; height: 6px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }

/* ── Activity ── */
.activity-item { display: flex; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); align-items: flex-start; }
.activity-item:last-child { border-bottom: none; }
.activity-item:hover { background: var(--bg); }
.activity-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.activity-text { font-size: 13px; color: var(--t2); line-height: 1.5; }
.activity-time { font-size: 11px; color: var(--t4); margin-top: 2px; }

/* ── Chart ── */
.chart-bars { display: flex; align-items: flex-end; gap: 8px; height: 80px; }
.chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
.chart-bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.4s ease; }
.chart-label { font-size: 10px; color: var(--t4); font-weight: 500; }

/* ── Empty ── */
.empty { padding: 40px; text-align: center; }
.empty-icon { font-size: 28px; margin-bottom: 10px; opacity: 0.4; }
.empty-text { font-size: 13px; color: var(--t3); }

/* ── Quittance ── */
.quittance-preview {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 36px;
  font-family: Georgia, serif;
  color: #111;
  line-height: 1.7;
}
.q-header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #111; }
.q-header h1 { font-size: 20px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
.q-header p { font-size: 13px; color: #555; margin-top: 4px; }
.q-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
.q-block .q-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; font-family: Arial, sans-serif; }
.q-block .q-value { font-size: 13px; line-height: 1.6; }
.q-total { background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 18px 22px; margin: 20px 0; }
.q-total-label { font-size: 12px; color: #666; font-family: Arial, sans-serif; }
.q-total-amount { font-size: 30px; font-weight: bold; margin-top: 4px; }
.q-total-detail { font-size: 12px; color: #888; margin-top: 6px; font-family: Arial, sans-serif; }
.q-sign { display: flex; justify-content: space-between; margin-top: 40px; }
.q-sign-box { text-align: center; font-size: 12px; color: #888; min-width: 180px; font-family: Arial, sans-serif; }
.q-sign-line { height: 50px; border-bottom: 1px solid #ccc; margin-bottom: 8px; }
.q-footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; font-family: Arial, sans-serif; }

/* ── Chip ── */
.chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; background: var(--bg); color: var(--t3); border: 1px solid var(--border); }

@media (max-width: 1100px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

function Badge({ status }) {
  const map = {
    "loue": ["bg", "Loue"], "paye": ["bg", "Paye"],
    "vacant": ["bn", "Vacant"], "en retard": ["br", "En retard"],
    "en cours": ["ba", "En cours"], "planifie": ["bb", "Planifie"],
    "termine": ["bg", "Termine"], "urgente": ["br", "Urgente"],
    "haute": ["ba", "Haute"], "basse": ["bn", "Basse"],
  };
  const [cls, label] = map[status] || ["bn", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Ring({ value, max, color, label, size = 80 }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring-svg" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="ring-text">
        <span className="ring-pct">{Math.round(pct * 100)}%</span>
        <span className="ring-lbl">{label}</span>
      </div>
    </div>
  );
}

function RevenueChart({ payments }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const total = payments.filter(p => p.status === "paye" && p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0);
    months.push({ label, total });
  }
  const maxVal = Math.max(...months.map(m => m.total), 1);
  return (
    <div style={{ padding: "16px 20px 12px" }}>
      <div className="chart-bars">
        {months.map((m, i) => (
          <div className="chart-bar-wrap" key={i}>
            <div className="chart-bar" style={{
              height: `${(m.total / maxVal) * 100}%`,
              background: m.total > 0 ? "var(--accent)" : "var(--border)",
            }} title={fmt(m.total)} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }} className="chart-label">{m.label}</div>
        ))}
      </div>
    </div>
  );
}

function QuittanceModal({ payment, tenant, apartment, owner, onClose }) {
  const month = monthName(payment.date);
  const print = () => {
    const content = document.getElementById("quittance-content").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Quittance ${month}</title>
    <style>
      body { font-family: Georgia, serif; padding: 40px; color: #111; line-height: 1.7; max-width: 700px; margin: 0 auto; }
      .q-header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #111; }
      .q-header h1 { font-size: 20px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
      .q-header p { font-size: 13px; color: #555; margin-top: 4px; }
      .q-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
      .q-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; font-family: Arial; }
      .q-value { font-size: 13px; line-height: 1.6; }
      .q-total { background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 18px 22px; margin: 20px 0; }
      .q-total-label { font-size: 12px; color: #666; font-family: Arial; }
      .q-total-amount { font-size: 30px; font-weight: bold; margin-top: 4px; }
      .q-total-detail { font-size: 12px; color: #888; margin-top: 6px; font-family: Arial; }
      .q-sign { display: flex; justify-content: space-between; margin-top: 40px; }
      .q-sign-box { text-align: center; font-size: 12px; color: #888; min-width: 180px; font-family: Arial; }
      .q-sign-line { height: 50px; border-bottom: 1px solid #ccc; margin-bottom: 8px; }
      .q-footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; font-family: Arial; }
    </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-title">Quittance de loyer</div>
        <div className="modal-sub">Apercu — cliquez sur Imprimer pour generer le PDF</div>
        <div id="quittance-content" className="quittance-preview">
          <div className="q-header">
            <h1>Quittance de loyer</h1>
            <p>Periode : {month}</p>
          </div>
          <div className="q-grid">
            <div className="q-block">
              <div className="q-label">Bailleur</div>
              <div className="q-value">
                <strong>{owner.name}</strong><br />
                {owner.address}<br />{owner.zip} {owner.city}<br />
                {owner.email}<br />{owner.phone}
                {owner.siret && <><br />SIRET : {owner.siret}</>}
              </div>
            </div>
            <div className="q-block">
              <div className="q-label">Locataire</div>
              <div className="q-value">
                <strong>{tenant.name}</strong><br />
                {apartment.address}<br />{apartment.zip} {apartment.city}
              </div>
            </div>
          </div>
          <div className="q-block" style={{ marginBottom: 16 }}>
            <div className="q-label">Bien loue</div>
            <div className="q-value">{apartment.name} — {apartment.address}, {apartment.zip} {apartment.city} — {apartment.surface} m² — {apartment.rooms} piece(s)</div>
          </div>
          <div className="q-total">
            <div className="q-total-label">Somme recue de {tenant.name} pour le mois de {month}</div>
            <div className="q-total-amount">{fmt(payment.amount)}</div>
            <div className="q-total-detail">Dont loyer : {fmt(apartment.rent)} — Dont charges : {fmt(apartment.charges)}{payment.method ? ` — Paiement par ${payment.method}` : ""}{payment.reference ? ` (${payment.reference})` : ""}</div>
          </div>
          <div className="q-sign">
            <div className="q-sign-box">
              <div className="q-sign-line"></div>
              <div>Signature du bailleur</div>
              <div style={{ marginTop: 4, fontWeight: "bold", color: "#333" }}>{owner.name}</div>
            </div>
            <div className="q-sign-box">
              <div className="q-sign-line"></div>
              <div>Date d'emission</div>
              <div style={{ marginTop: 4, fontWeight: "bold", color: "#333" }}>{fmtDate(new Date().toISOString().split("T")[0])}</div>
            </div>
          </div>
          <div className="q-footer">Document genere via ImmoGest — A valeur de recu de paiement de loyer</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" onClick={print}>🖨 Imprimer / Telecharger PDF</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data }) {
  const loue = data.apartments.filter(a => a.status === "loue").length;
  const totalRent = data.apartments.filter(a => a.status === "loue").reduce((s, a) => s + a.rent + a.charges, 0);
  const late = data.payments.filter(p => p.status === "en retard").length;
  const totalPaid = data.payments.filter(p => p.status === "paye").reduce((s, p) => s + p.amount, 0);
  const expiringLeases = data.tenants.filter(t => { const d = daysUntil(t.leaseEnd); return d >= 0 && d <= 90; });
  const recentPayments = [...data.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div>
      {late > 0 && <div className="alert alert-red">⚠️ {late} paiement(s) en retard — veuillez relancer le(s) locataire(s) concerné(s)</div>}
      {expiringLeases.length > 0 && <div className="alert alert-amber">📅 {expiringLeases.length} bail(s) expirent dans moins de 90 jours : {expiringLeases.map(t => t.name).join(", ")}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Occupation</span>
            <div className="stat-icon-wrap" style={{ background: "#eff6ff" }}>🏠</div>
          </div>
          <div className="stat-value">{loue}<span style={{ fontSize: 16, color: "var(--t3)", fontWeight: 500 }}>/{data.apartments.length}</span></div>
          <div className="stat-delta">{data.apartments.length - loue} bien(s) vacant(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Revenus mensuels</span>
            <div className="stat-icon-wrap" style={{ background: "#f0fdf4" }}>💶</div>
          </div>
          <div className="stat-value" style={{ fontSize: 20 }}>{fmt(totalRent)}</div>
          <div className="stat-delta green">Loyers + charges</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Retards</span>
            <div className="stat-icon-wrap" style={{ background: late > 0 ? "#fef2f2" : "#f0fdf4" }}>⏱</div>
          </div>
          <div className="stat-value">{late}</div>
          <div className={`stat-delta ${late > 0 ? "red" : "green"}`}>{late > 0 ? "Action requise" : "Tout est a jour"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Total encaisse</span>
            <div className="stat-icon-wrap" style={{ background: "#fffbeb" }}>📊</div>
          </div>
          <div className="stat-value" style={{ fontSize: 20 }}>{fmt(totalPaid)}</div>
          <div className="stat-delta">Tous paiements</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Revenus — 6 derniers mois</span></div>
          <RevenueChart payments={data.payments} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Taux d'occupation</span></div>
          <div style={{ padding: "16px 20px", display: "flex", gap: 20, alignItems: "center" }}>
            <Ring value={loue} max={data.apartments.length} color="#2563eb" label="Occ." />
            <div style={{ flex: 1 }}>
              {data.apartments.map(a => (
                <div key={a.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "var(--t2)", fontWeight: 500 }}>{a.name}</span>
                    <span style={{ color: "var(--t1)", fontWeight: 600 }}>{fmt(a.rent + a.charges)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${Math.min((a.rent / 2500) * 100, 100)}%`, background: a.status === "loue" ? "#2563eb" : "#e2e8f0" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Derniers paiements</span>
            <span className="card-count">{recentPayments.length}</span>
          </div>
          <table>
            <thead><tr><th>Locataire</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
            <tbody>
              {recentPayments.map(p => {
                const t = data.tenants.find(t => t.id === p.tenantId);
                return (
                  <tr key={p.id}>
                    <td className="td-primary">{t?.name || "-"}</td>
                    <td className="td-mono">{fmt(p.amount)}</td>
                    <td className="td-mono">{fmtDate(p.date)}</td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Maintenance en cours</span></div>
          <table>
            <thead><tr><th>Bien</th><th>Description</th><th>Priorite</th><th>Statut</th></tr></thead>
            <tbody>
              {data.maintenances.filter(m => m.status !== "termine").map(m => {
                const a = data.apartments.find(a => a.id === m.apartmentId);
                return (
                  <tr key={m.id}>
                    <td className="td-primary">{a?.name || "-"}</td>
                    <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</td>
                    <td><Badge status={m.priority} /></td>
                    <td><Badge status={m.status} /></td>
                  </tr>
                );
              })}
              {data.maintenances.filter(m => m.status !== "termine").length === 0 && (
                <tr><td colSpan={4}><div className="empty"><div className="empty-icon">✅</div><div className="empty-text">Aucune maintenance active</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Apartments({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name: "", address: "", city: "", zip: "", surface: "", rooms: "", rent: "", charges: "", status: "vacant", type: "appartement", floor: "", description: "" };
  const [form, setForm] = useState(empty);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (a) => { setEditing(a.id); setForm({ ...a }); setShowModal(true); };
  const save = () => {
    const parsed = { ...form, rent: +form.rent, charges: +form.charges, surface: +form.surface, rooms: +form.rooms, floor: +form.floor };
    if (editing) setData(d => ({ ...d, apartments: d.apartments.map(a => a.id === editing ? { ...parsed, id: editing } : a) }));
    else setData(d => ({ ...d, apartments: [...d.apartments, { ...parsed, id: Date.now() }] }));
    setShowModal(false);
  };
  const del = (id) => { if (window.confirm("Supprimer cet appartement ?")) setData(d => ({ ...d, apartments: d.apartments.filter(a => a.id !== id) })); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--t2)" }}>
          <strong style={{ color: "var(--t1)" }}>{data.apartments.length}</strong> bien(s) —
          Revenus potentiels : <strong style={{ color: "var(--accent)" }}>{fmt(data.apartments.filter(a => a.status === "loue").reduce((s, a) => s + a.rent + a.charges, 0))}/mois</strong>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Ajouter un bien</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Reference</th><th>Adresse</th><th>Type</th><th>Surface</th><th>Loyer HC</th><th>Charges</th><th>Total CC</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {data.apartments.map(a => (
              <tr key={a.id}>
                <td className="td-primary">{a.name}</td>
                <td>{a.address}, {a.zip} {a.city}</td>
                <td><span className="chip">{a.type}</span></td>
                <td>{a.surface} m² · {a.rooms}p</td>
                <td className="td-mono">{fmt(a.rent)}</td>
                <td className="td-mono">{fmt(a.charges)}</td>
                <td className="td-mono" style={{ fontWeight: 700, color: "var(--t1)" }}>{fmt(a.rent + a.charges)}</td>
                <td><Badge status={a.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Editer</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(a.id)}>Suppr.</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? "Modifier le bien" : "Ajouter un bien"}</div>
            <div className="modal-sub">{editing ? "Mise a jour des informations" : "Nouveau bien dans votre portefeuille"}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nom / Reference</label><input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)} placeholder="Apt 101" /></div>
              <div className="form-group"><label className="form-label">Type de bien</label>
                <select className="form-input" value={form.type} onChange={e => upd("type", e.target.value)}>
                  <option value="appartement">Appartement</option>
                  <option value="studio">Studio</option>
                  <option value="maison">Maison</option>
                  <option value="commercial">Local commercial</option>
                  <option value="garage">Garage</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={form.address} onChange={e => upd("address", e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Ville</label><input className="form-input" value={form.city} onChange={e => upd("city", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Code postal</label><input className="form-input" value={form.zip} onChange={e => upd("zip", e.target.value)} /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">Surface (m²)</label><input className="form-input" type="number" value={form.surface} onChange={e => upd("surface", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Pieces</label><input className="form-input" type="number" value={form.rooms} onChange={e => upd("rooms", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Etage</label><input className="form-input" type="number" value={form.floor} onChange={e => upd("floor", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Loyer HC (EUR)</label><input className="form-input" type="number" value={form.rent} onChange={e => upd("rent", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Charges (EUR)</label><input className="form-input" type="number" value={form.charges} onChange={e => upd("charges", e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Statut</label>
              <select className="form-input" value={form.status} onChange={e => upd("status", e.target.value)}>
                <option value="loue">Loue</option>
                <option value="vacant">Vacant</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.description} onChange={e => upd("description", e.target.value)} rows={2} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tenants({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { name: "", email: "", phone: "", apartmentId: "", leaseStart: "", leaseEnd: "", deposit: "", notes: "" };
  const [form, setForm] = useState(empty);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ ...t }); setShowModal(true); };
  const save = () => {
    const parsed = { ...form, apartmentId: +form.apartmentId, deposit: +form.deposit };
    if (editing) setData(d => ({ ...d, tenants: d.tenants.map(t => t.id === editing ? { ...parsed, id: editing } : t) }));
    else setData(d => ({ ...d, tenants: [...d.tenants, { ...parsed, id: Date.now() }] }));
    setShowModal(false);
  };
  const del = (id) => { if (window.confirm("Supprimer ce locataire ?")) setData(d => ({ ...d, tenants: d.tenants.filter(t => t.id !== id) })); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--t2)" }}><strong style={{ color: "var(--t1)" }}>{data.tenants.length}</strong> locataire(s) actif(s)</div>
        <button className="btn btn-primary" onClick={openNew}>+ Nouveau locataire</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nom</th><th>Contact</th><th>Appartement</th><th>Debut bail</th><th>Fin bail</th><th>Depot</th><th>Expiration</th><th>Actions</th></tr></thead>
          <tbody>
            {data.tenants.map(t => {
              const apt = data.apartments.find(a => a.id === t.apartmentId);
              const days = daysUntil(t.leaseEnd);
              return (
                <tr key={t.id}>
                  <td className="td-primary">{t.name}</td>
                  <td><div style={{ fontSize: 13 }}>{t.email}</div><div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{t.phone}</div></td>
                  <td>{apt?.name || "-"}</td>
                  <td className="td-mono">{fmtDate(t.leaseStart)}</td>
                  <td className="td-mono">{fmtDate(t.leaseEnd)}</td>
                  <td className="td-mono">{fmt(t.deposit)}</td>
                  <td>
                    {days < 0 ? <Badge status="en retard" /> :
                     days <= 30 ? <span style={{ color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{days}j</span> :
                     days <= 90 ? <span style={{ color: "var(--amber)", fontSize: 12, fontWeight: 600 }}>{days}j</span> :
                     <span style={{ color: "var(--t3)", fontSize: 12 }}>{days}j</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Editer</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(t.id)}>Suppr.</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? "Modifier le locataire" : "Nouveau locataire"}</div>
            <div className="modal-sub">Informations du bail et du locataire</div>
            <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => upd("email", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e => upd("apartmentId", e.target.value)}>
                <option value="">-- Selectionner un appartement --</option>
                {data.apartments.map(a => <option key={a.id} value={a.id}>{a.name} — {a.address}, {a.city}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Debut du bail</label><input className="form-input" type="date" value={form.leaseStart} onChange={e => upd("leaseStart", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Fin du bail</label><input className="form-input" type="date" value={form.leaseEnd} onChange={e => upd("leaseEnd", e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Depot de garantie (EUR)</label><input className="form-input" type="number" value={form.deposit} onChange={e => upd("deposit", e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={e => upd("notes", e.target.value)} rows={2} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Payments({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [quittance, setQuittance] = useState(null);
  const empty = { tenantId: "", apartmentId: "", amount: "", date: new Date().toISOString().split("T")[0], type: "Loyer + charges", status: "paye", method: "virement", reference: "" };
  const [form, setForm] = useState(empty);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    setData(d => ({ ...d, payments: [...d.payments, { ...form, id: Date.now(), tenantId: +form.tenantId, apartmentId: +form.apartmentId, amount: +form.amount }] }));
    setShowModal(false);
  };
  const toggle = (id) => setData(d => ({ ...d, payments: d.payments.map(p => p.id === id ? { ...p, status: p.status === "paye" ? "en retard" : "paye" } : p) }));
  const del = (id) => { if (window.confirm("Supprimer ce paiement ?")) setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== id) })); };

  const openQuittance = (p) => {
    const t = data.tenants.find(t => t.id === p.tenantId);
    const a = data.apartments.find(a => a.id === p.apartmentId);
    if (t && a) setQuittance({ payment: p, tenant: t, apartment: a });
  };

  const totalPaye = data.payments.filter(p => p.status === "paye").reduce((s, p) => s + p.amount, 0);
  const totalRetard = data.payments.filter(p => p.status === "en retard").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total encaisse</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--green)" }}>{fmt(totalPaye)}</div>
          </div>
          {totalRetard > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>En attente</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--red)" }}>{fmt(totalRetard)}</div>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setShowModal(true); }}>+ Enregistrer un paiement</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Locataire</th><th>Appartement</th><th>Type</th><th>Montant</th><th>Date</th><th>Methode</th><th>Reference</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {[...data.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map(p => {
              const t = data.tenants.find(t => t.id === p.tenantId);
              const a = data.apartments.find(a => a.id === p.apartmentId);
              return (
                <tr key={p.id}>
                  <td className="td-primary">{t?.name || "-"}</td>
                  <td>{a?.name || "-"}</td>
                  <td style={{ fontSize: 12 }}>{p.type}</td>
                  <td className="td-mono" style={{ fontWeight: 700, color: "var(--t1)" }}>{fmt(p.amount)}</td>
                  <td className="td-mono">{fmtDate(p.date)}</td>
                  <td><span className="chip">{p.method || "-"}</span></td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{p.reference || "-"}</td>
                  <td><Badge status={p.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      {p.status === "paye" && <button className="btn btn-success btn-sm" onClick={() => openQuittance(p)}>Quittance</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(p.id)}>Basculer</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>X</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Enregistrer un paiement</div>
            <div className="modal-sub">Loyer, charges, depot de garantie...</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Locataire</label>
                <select className="form-input" value={form.tenantId} onChange={e => upd("tenantId", e.target.value)}>
                  <option value="">-- Selectionner --</option>
                  {data.tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Appartement</label>
                <select className="form-input" value={form.apartmentId} onChange={e => upd("apartmentId", e.target.value)}>
                  <option value="">-- Selectionner --</option>
                  {data.apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Montant (EUR)</label><input className="form-input" type="number" value={form.amount} onChange={e => upd("amount", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => upd("date", e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => upd("type", e.target.value)}>
                  <option>Loyer + charges</option><option>Loyer seul</option><option>Charges seules</option><option>Depot de garantie</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Methode</label>
                <select className="form-input" value={form.method} onChange={e => upd("method", e.target.value)}>
                  <option value="virement">Virement</option><option value="cheque">Cheque</option><option value="especes">Especes</option><option value="prelevement">Prelevement</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Reference</label><input className="form-input" value={form.reference} onChange={e => upd("reference", e.target.value)} placeholder="VIR-2026-05-001" /></div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input" value={form.status} onChange={e => upd("status", e.target.value)}>
                  <option value="paye">Paye</option><option value="en retard">En retard</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {quittance && (
        <QuittanceModal payment={quittance.payment} tenant={quittance.tenant} apartment={quittance.apartment} owner={data.owner} onClose={() => setQuittance(null)} />
      )}
    </div>
  );
}

function Maintenance({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { apartmentId: "", description: "", date: new Date().toISOString().split("T")[0], status: "planifie", priority: "basse", cost: "", provider: "", notes: "" };
  const [form, setForm] = useState(empty);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (m) => { setEditing(m.id); setForm({ ...m }); setShowModal(true); };
  const save = () => {
    const parsed = { ...form, apartmentId: +form.apartmentId, cost: +form.cost };
    if (editing) setData(d => ({ ...d, maintenances: d.maintenances.map(m => m.id === editing ? { ...parsed, id: editing } : m) }));
    else setData(d => ({ ...d, maintenances: [...d.maintenances, { ...parsed, id: Date.now() }] }));
    setShowModal(false);
  };
  const next = { "planifie": "en cours", "en cours": "termine", "termine": "planifie" };
  const advance = (id) => setData(d => ({ ...d, maintenances: d.maintenances.map(m => m.id === id ? { ...m, status: next[m.status] } : m) }));
  const del = (id) => { if (window.confirm("Supprimer cette intervention ?")) setData(d => ({ ...d, maintenances: d.maintenances.filter(m => m.id !== id) })); };

  const totalCout = data.maintenances.reduce((s, m) => s + (m.cost || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cout total des interventions</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--amber)" }}>{fmt(totalCout)}</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Signaler une intervention</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Appartement</th><th>Description</th><th>Prestataire</th><th>Priorite</th><th>Date</th><th>Cout</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {data.maintenances.map(m => {
              const a = data.apartments.find(a => a.id === m.apartmentId);
              return (
                <tr key={m.id}>
                  <td className="td-primary">{a?.name || "-"}</td>
                  <td style={{ maxWidth: 180 }}>{m.description}</td>
                  <td style={{ fontSize: 12 }}>{m.provider || "-"}</td>
                  <td><Badge status={m.priority} /></td>
                  <td className="td-mono">{fmtDate(m.date)}</td>
                  <td className="td-mono">{m.cost ? fmt(m.cost) : "-"}</td>
                  <td><Badge status={m.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => advance(m.id)}>Avancer</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Editer</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(m.id)}>X</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? "Modifier l'intervention" : "Nouvelle intervention"}</div>
            <div className="modal-sub">Suivi des travaux et reparations</div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e => upd("apartmentId", e.target.value)}>
                <option value="">-- Selectionner --</option>
                {data.apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e => upd("description", e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Priorite</label>
                <select className="form-input" value={form.priority} onChange={e => upd("priority", e.target.value)}>
                  <option value="urgente">Urgente</option><option value="haute">Haute</option><option value="basse">Basse</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input" value={form.status} onChange={e => upd("status", e.target.value)}>
                  <option value="planifie">Planifie</option><option value="en cours">En cours</option><option value="termine">Termine</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prestataire</label><input className="form-input" value={form.provider} onChange={e => upd("provider", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Cout (EUR)</label><input className="form-input" type="number" value={form.cost} onChange={e => upd("cost", e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => upd("date", e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Settings({ data, setData }) {
  const [form, setForm] = useState({ ...data.owner });
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    setData(d => ({ ...d, owner: { ...form } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>
        Ces informations apparaissent sur les <strong>quittances de loyer</strong> generees par l'application.
      </div>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 16 }}>Informations du proprietaire</div>
        <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={form.address} onChange={e => upd("address", e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Ville</label><input className="form-input" value={form.city} onChange={e => upd("city", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Code postal</label><input className="form-input" value={form.zip} onChange={e => upd("zip", e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => upd("email", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">SIRET (optionnel)</label><input className="form-input" value={form.siret} onChange={e => upd("siret", e.target.value)} placeholder="123 456 789 00010" /></div>
        <button className="btn btn-primary" onClick={save} style={{ marginTop: 8 }}>
          {saved ? "✓ Sauvegarde !" : "Sauvegarder"}
        </button>
      </div>
      <div className="card" style={{ padding: 24, marginTop: 16, borderColor: "#fecaca" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>Zone dangereuse</div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 14 }}>Reinitialise toutes les donnees. Action irreversible.</div>
        <button className="btn btn-danger" onClick={() => { if (window.confirm("Reinitialiser toutes les donnees ?")) { localStorage.removeItem(STORAGE_KEY); window.location.reload(); } }}>
          Reinitialiser toutes les donnees
        </button>
      </div>
    </div>
  );
}

const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "apartments", label: "Appartements", icon: "🏠" },
  { id: "tenants", label: "Locataires", icon: "👥" },
  { id: "payments", label: "Paiements", icon: "💶" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
  { id: "settings", label: "Parametres", icon: "⚙️" },
];

const TITLES = {
  dashboard: ["Tableau de bord", "Vue d'ensemble"],
  apartments: ["Appartements", "Portefeuille immobilier"],
  tenants: ["Locataires", "Gestion des baux"],
  payments: ["Paiements", "Loyers et encaissements"],
  maintenance: ["Maintenance", "Travaux et interventions"],
  settings: ["Parametres", "Configuration du compte"],
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(loadData);
  useEffect(() => { saveData(data); }, [data]);

  const lateCount = data.payments.filter(p => p.status === "en retard").length;
  const pages = { dashboard: Dashboard, apartments: Apartments, tenants: Tenants, payments: Payments, maintenance: Maintenance, settings: Settings };
  const Page = pages[page];
  const [title, sub] = TITLES[page];
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-row">
              <div className="brand-icon">🏢</div>
              <div>
                <div className="brand-name">ImmoGest</div>
                <div className="brand-version">Gestion locative pro</div>
              </div>
            </div>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Navigation</div>
            {NAV.map(n => (
              <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
                {n.id === "payments" && lateCount > 0 && <span className="nav-badge">{lateCount}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-stats">
              <div className="sidebar-stat">
                <div className="sidebar-stat-val">{data.apartments.filter(a => a.status === "loue").length}</div>
                <div className="sidebar-stat-label">Loues</div>
              </div>
              <div className="sidebar-stat">
                <div className="sidebar-stat-val">{data.tenants.length}</div>
                <div className="sidebar-stat-label">Locataires</div>
              </div>
            </div>
          </div>
        </nav>
        <div className="main">
          <div className="topbar">
            <span className="topbar-title">{title}</span>
            <span className="topbar-sep">—</span>
            <span className="topbar-sub">{sub}</span>
            <div className="topbar-right">
              <div className="topbar-date">{today}</div>
            </div>
          </div>
<div className="content">
            <Page data={data} setData={setData} />
          </div>
        </div>
      </div>
    </>
  );
}