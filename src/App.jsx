import { useState, useEffect, useRef } from "react";

// ─── Local Storage Persistence ────────────────────────────────────────────────
const STORAGE_KEY = "immogest_data_v2";

const defaultData = {
  apartments: [
    { id: 1, name: "Apt 101", address: "12 Rue de la Paix", city: "Paris", zip: "75001", surface: 45, rooms: 2, rent: 1200, charges: 150, status: "loue", type: "appartement", floor: 1, description: "" },
    { id: 2, name: "Apt 202", address: "8 Avenue Montaigne", city: "Paris", zip: "75008", surface: 72, rooms: 3, rent: 2100, charges: 200, status: "loue", type: "appartement", floor: 2, description: "" },
    { id: 3, name: "Apt 305", address: "3 Rue du Faubourg", city: "Lyon", zip: "69001", surface: 30, rooms: 1, rent: 650, charges: 80, status: "vacant", type: "studio", floor: 3, description: "" },
    { id: 4, name: "Apt 410", address: "21 Boulevard Victor Hugo", city: "Nice", zip: "06000", surface: 60, rooms: 3, rent: 1450, charges: 120, status: "loue", type: "appartement", floor: 4, description: "" },
  ],
  tenants: [
    { id: 1, name: "Marie Dupont", email: "marie.dupont@email.fr", phone: "06 12 34 56 78", apartmentId: 1, leaseStart: "2024-01-01", leaseEnd: "2024-12-31", deposit: 2400, depositReturned: false, notes: "" },
    { id: 2, name: "Thomas Bernard", email: "thomas.b@email.fr", phone: "07 98 76 54 32", apartmentId: 2, leaseStart: "2023-09-01", leaseEnd: "2025-08-31", deposit: 4200, depositReturned: false, notes: "" },
    { id: 3, name: "Isabelle Martin", email: "i.martin@email.fr", phone: "06 55 44 33 22", apartmentId: 4, leaseStart: "2024-03-15", leaseEnd: "2025-03-14", deposit: 2900, depositReturned: false, notes: "" },
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "-";
const monthName = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #080a0f;
  --surface: #0d1017;
  --card: #111520;
  --card2: #151a27;
  --border: #1c2235;
  --border2: #242d42;
  --accent: #3b82f6;
  --accent2: #60a5fa;
  --accent-glow: rgba(59,130,246,0.15);
  --green: #10b981;
  --green-soft: rgba(16,185,129,0.12);
  --red: #ef4444;
  --red-soft: rgba(239,68,68,0.12);
  --amber: #f59e0b;
  --amber-soft: rgba(245,158,11,0.12);
  --purple: #8b5cf6;
  --purple-soft: rgba(139,92,246,0.12);
  --t1: #f1f5f9;
  --t2: #94a3b8;
  --t3: #475569;
  --t4: #1e293b;
  --font: 'Syne', sans-serif;
  --mono: 'DM Mono', monospace;
  --r: 10px;
  --r2: 14px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
}

body { background: var(--bg); color: var(--t1); font-family: var(--font); min-height: 100vh; overflow-x: hidden; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

/* Layout */
.app { display: flex; min-height: 100vh; }

/* Sidebar */
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
  overflow: hidden;
}
.sidebar::before {
  content: '';
  position: absolute;
  top: -60px; left: -60px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.sidebar-brand {
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--border);
}
.brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}
.brand-icon {
  width: 32px; height: 32px;
  background: var(--accent);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  box-shadow: 0 0 16px rgba(59,130,246,0.3);
}
.brand-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.5px;
}
.brand-tag {
  font-size: 10px;
  color: var(--t3);
  letter-spacing: 2px;
  text-transform: uppercase;
  font-family: var(--mono);
  margin-left: 42px;
}
.nav-section {
  padding: 16px 12px 8px;
}
.nav-section-label {
  font-size: 9px;
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: var(--mono);
  padding: 0 8px;
  margin-bottom: 6px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  font-weight: 500;
  color: var(--t3);
  position: relative;
  margin-bottom: 2px;
}
.nav-item:hover { background: var(--card); color: var(--t2); }
.nav-item.active {
  background: var(--accent-glow);
  color: var(--accent2);
  border: 1px solid rgba(59,130,246,0.2);
}
.nav-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }
.nav-badge {
  margin-left: auto;
  background: var(--red);
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  font-family: var(--mono);
}
.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border);
}
.sidebar-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sidebar-stat {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 10px;
  text-align: center;
}
.sidebar-stat-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
}
.sidebar-stat-label {
  font-size: 9px;
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--mono);
  margin-top: 2px;
}

/* Main */
.main { margin-left: 220px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; }

/* Topbar */
.topbar {
  height: 56px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 28px;
  gap: 16px;
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 50;
}
.topbar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}
.topbar-sub {
  font-size: 12px;
  color: var(--t3);
  font-family: var(--mono);
}
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.topbar-date {
  font-size: 11px;
  color: var(--t3);
  font-family: var(--mono);
  background: var(--card);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 6px;
}

/* Content */
.content { padding: 24px 28px; flex: 1; }

/* Alert banner */
.alert-bar {
  background: var(--red-soft);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: var(--r);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--red);
}
.alert-bar-amber {
  background: var(--amber-soft);
  border-color: rgba(245,158,11,0.25);
  color: var(--amber);
}

/* Stat grid */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  padding: 18px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}
.stat-card:hover { border-color: var(--border2); }
.stat-card::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 0 0 var(--r2) var(--r2);
}
.stat-card.blue::after { background: var(--accent); }
.stat-card.green::after { background: var(--green); }
.stat-card.red::after { background: var(--red); }
.stat-card.amber::after { background: var(--amber); }
.stat-card.purple::after { background: var(--purple); }
.stat-icon {
  font-size: 20px;
  margin-bottom: 12px;
  display: block;
}
.stat-label {
  font-size: 10px;
  color: var(--t3);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-family: var(--mono);
  margin-bottom: 6px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--t1);
  letter-spacing: -1px;
  line-height: 1;
}
.stat-delta {
  font-size: 11px;
  color: var(--t3);
  margin-top: 6px;
  font-family: var(--mono);
}

/* Cards / sections */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  overflow: hidden;
  margin-bottom: 16px;
}
.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-title { font-size: 13px; font-weight: 700; color: var(--t1); }
.card-count {
  font-size: 10px;
  font-family: var(--mono);
  color: var(--t3);
  background: var(--card2);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--border);
}
.card-actions { margin-left: auto; display: flex; gap: 8px; }

/* Table */
table { width: 100%; border-collapse: collapse; }
th {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--t3);
  padding: 10px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
  white-space: nowrap;
}
td {
  padding: 12px 20px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  color: var(--t2);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.015); }
.td-primary { color: var(--t1) !important; font-weight: 600; }
.td-mono { font-family: var(--mono); font-size: 11px !important; }

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--mono);
  white-space: nowrap;
}
.badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; }
.bg { background: var(--green-soft); color: var(--green); border: 1px solid rgba(16,185,129,0.2); }
.bg::before { background: var(--green); }
.br { background: var(--red-soft); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
.br::before { background: var(--red); }
.ba { background: var(--amber-soft); color: var(--amber); border: 1px solid rgba(245,158,11,0.2); }
.ba::before { background: var(--amber); }
.bb { background: var(--accent-glow); color: var(--accent2); border: 1px solid rgba(59,130,246,0.2); }
.bb::before { background: var(--accent); }
.bp { background: var(--purple-soft); color: var(--purple); border: 1px solid rgba(139,92,246,0.2); }
.bp::before { background: var(--purple); }
.bn { background: var(--card2); color: var(--t3); border: 1px solid var(--border); }
.bn::before { background: var(--t3); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: var(--font);
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-primary { background: var(--accent); color: #fff; box-shadow: 0 0 16px rgba(59,130,246,0.25); }
.btn-primary:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 0 20px rgba(59,130,246,0.35); }
.btn-ghost { background: var(--card2); color: var(--t2); border: 1px solid var(--border); }
.btn-ghost:hover { border-color: var(--border2); color: var(--t1); }
.btn-danger { background: var(--red-soft); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
.btn-danger:hover { background: rgba(239,68,68,0.2); }
.btn-success { background: var(--green-soft); color: var(--green); border: 1px solid rgba(16,185,129,0.2); }
.btn-success:hover { background: rgba(16,185,129,0.2); }
.btn-sm { padding: 5px 10px; font-size: 11px; }

/* Two-col */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

/* Modal */
.overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 300;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: var(--card);
  border: 1px solid var(--border2);
  border-radius: 16px;
  padding: 28px;
  width: 560px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.2s ease;
  box-shadow: var(--shadow);
}
.modal-lg { width: 720px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.modal-title { font-size: 20px; font-weight: 800; color: var(--t1); margin-bottom: 6px; letter-spacing: -0.5px; }
.modal-sub { font-size: 12px; color: var(--t3); font-family: var(--mono); margin-bottom: 24px; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }

/* Form */
.form-group { margin-bottom: 14px; }
.form-label { display: block; font-size: 10px; color: var(--t3); text-transform: uppercase; letter-spacing: 1.5px; font-family: var(--mono); margin-bottom: 6px; }
.form-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--t1);
  font-family: var(--font);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
select.form-input option { background: var(--card); }
textarea.form-input { resize: vertical; min-height: 80px; }

/* KPI Ring */
.ring-wrap { position: relative; display: inline-block; }
.ring-svg { transform: rotate(-90deg); display: block; }
.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.ring-pct { font-size: 20px; font-weight: 800; color: var(--t1); line-height: 1; }
.ring-lbl { font-size: 9px; color: var(--t3); font-family: var(--mono); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

/* Progress */
.progress { background: var(--border); border-radius: 4px; height: 5px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }

/* Activity */
.activity-item {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  align-items: flex-start;
  transition: background 0.1s;
}
.activity-item:last-child { border-bottom: none; }
.activity-item:hover { background: rgba(255,255,255,0.015); }
.activity-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.activity-text { font-size: 12px; color: var(--t2); line-height: 1.5; }
.activity-time { font-size: 10px; color: var(--t3); font-family: var(--mono); margin-top: 2px; }

/* Empty state */
.empty { padding: 48px; text-align: center; }
.empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.4; }
.empty-text { font-size: 13px; color: var(--t3); }

/* Quittance print */
.quittance-preview {
  background: white;
  color: #111;
  border-radius: 8px;
  padding: 40px;
  font-family: Georgia, serif;
  line-height: 1.6;
}
.quittance-preview h1 { font-size: 22px; text-align: center; margin-bottom: 8px; }
.quittance-preview .q-sub { text-align: center; font-size: 13px; color: #666; margin-bottom: 32px; }
.quittance-preview .q-block { margin-bottom: 20px; }
.quittance-preview .q-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
.quittance-preview .q-value { font-size: 14px; }
.quittance-preview .q-total { background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; margin: 24px 0; }
.quittance-preview .q-total-label { font-size: 12px; color: #666; }
.quittance-preview .q-total-amount { font-size: 28px; font-weight: bold; color: #111; }
.quittance-preview .q-footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
.quittance-preview .q-sign { margin-top: 40px; display: flex; justify-content: space-between; }
.quittance-preview .q-sign-box { text-align: center; font-size: 12px; color: #888; }

/* Chart bar */
.chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; padding: 0 4px; }
.chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
.chart-bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.4s ease; }
.chart-bar-label { font-size: 9px; color: var(--t3); font-family: var(--mono); text-align: center; }

/* Notification dot */
.notif-dot {
  width: 8px; height: 8px;
  background: var(--red);
  border-radius: 50%;
  position: absolute;
  top: 6px; right: 6px;
  box-shadow: 0 0 6px var(--red);
}

/* Tag chips */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-family: var(--mono);
  background: var(--card2);
  color: var(--t3);
  border: 1px solid var(--border);
}

/* Info row in modal */
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.info-row:last-child { border-bottom: none; }
.info-key { color: var(--t3); font-family: var(--mono); font-size: 11px; }
.info-val { color: var(--t1); font-weight: 600; }

@media (max-width: 1100px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
}
`;

// ─── Badge Component ──────────────────────────────────────────────────────────
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

// ─── Ring Chart ───────────────────────────────────────────────────────────────
function Ring({ value, max, color, label, size = 80 }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring-svg" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
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

// ─── Revenue Chart ────────────────────────────────────────────────────────────
function RevenueChart({ payments }) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "short" });
    const total = payments
      .filter(p => p.status === "paye" && p.date.startsWith(key))
      .reduce((s, p) => s + p.amount, 0);
    months.push({ label, total, key });
  }
  const maxVal = Math.max(...months.map(m => m.total), 1);
  return (
    <div>
      <div className="chart-bars">
        {months.map((m, i) => (
          <div className="chart-bar-wrap" key={i}>
            <div className="chart-bar" style={{
              height: `${(m.total / maxVal) * 100}%`,
              background: m.total > 0 ? "var(--accent)" : "var(--border)",
              opacity: i === months.length - 1 ? 1 : 0.5 + (i / months.length) * 0.5,
            }} title={fmt(m.total)} />
          </div>
        ))}
      </div>
      <div className="chart-bars" style={{ height: "auto", marginTop: 4 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--t3)", fontFamily: "var(--mono)" }}>
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quittance Modal ──────────────────────────────────────────────────────────
function QuittanceModal({ payment, tenant, apartment, owner, onClose }) {
  const month = monthName(payment.date);
  const printQuittance = () => {
    const content = document.getElementById("quittance-content").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Quittance ${month}</title>
    <style>
      body { font-family: Georgia, serif; padding: 40px; color: #111; line-height: 1.6; }
      h1 { font-size: 22px; text-align: center; margin-bottom: 8px; }
      .q-sub { text-align: center; font-size: 13px; color: #666; margin-bottom: 32px; }
      .q-block { margin-bottom: 20px; }
      .q-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
      .q-value { font-size: 14px; }
      .q-total { background: #f8f8f8; border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; margin: 24px 0; }
      .q-total-label { font-size: 12px; color: #666; }
      .q-total-amount { font-size: 28px; font-weight: bold; }
      .q-footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
      .q-sign { margin-top: 40px; display: flex; justify-content: space-between; }
      .q-sign-box { text-align: center; font-size: 12px; color: #888; min-width: 200px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-title">Quittance de loyer</div>
        <div className="modal-sub">Apercu avant impression / telechargement</div>
        <div id="quittance-content" className="quittance-preview">
          <h1>QUITTANCE DE LOYER</h1>
          <div className="q-sub">Periode : {month}</div>
          <div className="two">
            <div className="q-block">
              <div className="q-label">Bailleur</div>
              <div className="q-value"><strong>{owner.name}</strong><br />
                {owner.address}<br />{owner.zip} {owner.city}<br />
                {owner.email}<br />{owner.phone}
                {owner.siret && <><br />SIRET : {owner.siret}</>}
              </div>
            </div>
            <div className="q-block">
              <div className="q-label">Locataire</div>
              <div className="q-value"><strong>{tenant.name}</strong><br />
                {apartment.address}<br />{apartment.zip} {apartment.city}
              </div>
            </div>
          </div>
          <div className="q-block">
            <div className="q-label">Bien loue</div>
            <div className="q-value">{apartment.name} — {apartment.address}, {apartment.zip} {apartment.city} — {apartment.surface} m² — {apartment.rooms} piece(s)</div>
          </div>
          <div className="q-total">
            <div className="q-total-label">Total recu de {tenant.name} pour le mois de {month}</div>
            <div className="q-total-amount">{fmt(payment.amount)}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
              Dont loyer : {fmt(apartment.rent)} — Dont charges : {fmt(apartment.charges)}
            </div>
          </div>
          <div className="q-block">
            <div className="q-label">Mode de paiement</div>
            <div className="q-value">{payment.method || "Non specifie"} {payment.reference ? `— Ref : ${payment.reference}` : ""}</div>
          </div>
          <div className="q-sign">
            <div className="q-sign-box">
              <div style={{ borderBottom: "1px solid #ccc", height: 60, marginBottom: 8 }}></div>
              <div>Signature du bailleur</div>
              <div style={{ marginTop: 4 }}>{owner.name}</div>
            </div>
            <div className="q-sign-box">
              <div style={{ borderBottom: "1px solid #ccc", height: 60, marginBottom: 8 }}></div>
              <div>Date d'emission</div>
              <div style={{ marginTop: 4 }}>{fmtDate(new Date().toISOString().split("T")[0])}</div>
            </div>
          </div>
          <div className="q-footer">
            Quittance generee via ImmoGest — Document a valeur de recu de paiement
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" onClick={printQuittance}>🖨 Imprimer / PDF</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const loue = data.apartments.filter(a => a.status === "loue").length;
  const totalRent = data.apartments.filter(a => a.status === "loue").reduce((s, a) => s + a.rent + a.charges, 0);
  const late = data.payments.filter(p => p.status === "en retard").length;
  const totalPaid = data.payments.filter(p => p.status === "paye").reduce((s, p) => s + p.amount, 0);
  const totalMaintCost = data.maintenances.filter(m => m.status === "termine").reduce((s, m) => s + (m.cost || 0), 0);

  // Expiring leases (within 90 days)
  const expiringLeases = data.tenants.filter(t => {
    const d = daysUntil(t.leaseEnd);
    return d >= 0 && d <= 90;
  });

  // Recent payments
  const recentPayments = [...data.payments]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div>
      {late > 0 && (
        <div className="alert-bar">
          ⚠️ {late} paiement(s) en retard — action requise
        </div>
      )}
      {expiringLeases.length > 0 && (
        <div className="alert-bar alert-bar-amber">
          📅 {expiringLeases.length} bail(s) expirent dans moins de 90 jours : {expiringLeases.map(t => t.name).join(", ")}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card blue">
          <span className="stat-icon">🏠</span>
          <div className="stat-label">Occupation</div>
          <div className="stat-value">{loue}/{data.apartments.length}</div>
          <div className="stat-delta">{data.apartments.length - loue} vacant(s)</div>
        </div>
        <div className="stat-card green">
          <span className="stat-icon">💶</span>
          <div className="stat-label">Revenus mensuels</div>
          <div className="stat-value">{fmt(totalRent)}</div>
          <div className="stat-delta">Loyers + charges</div>
        </div>
        <div className={`stat-card ${late > 0 ? "red" : "green"}`}>
          <span className="stat-icon">⏱</span>
          <div className="stat-label">Retards</div>
          <div className="stat-value">{late}</div>
          <div className="stat-delta">{late > 0 ? "Action requise" : "Tout a jour"}</div>
        </div>
        <div className="stat-card amber">
          <span className="stat-icon">📊</span>
          <div className="stat-label">Total encaisse</div>
          <div className="stat-value">{fmt(totalPaid)}</div>
          <div className="stat-delta">Tous paiements</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenus 6 derniers mois</span>
          </div>
          <div style={{ padding: "16px 20px 12px" }}>
            <RevenueChart payments={data.payments} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Performance</span>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", gap: 24, alignItems: "center" }}>
            <Ring value={loue} max={data.apartments.length} color="var(--accent)" label="Occ." />
            <div style={{ flex: 1 }}>
              {data.apartments.map(a => (
                <div key={a.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: "var(--t2)" }}>{a.name}</span>
                    <span style={{ color: "var(--t1)", fontFamily: "var(--mono)" }}>{fmt(a.rent + a.charges)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{
                      width: `${Math.min((a.rent / 2500) * 100, 100)}%`,
                      background: a.status === "loue" ? "var(--accent)" : "var(--border2)"
                    }} />
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
          <div className="card-header">
            <span className="card-title">Maintenance active</span>
          </div>
          <table>
            <thead><tr><th>Bien</th><th>Description</th><th>Priorite</th><th>Statut</th></tr></thead>
            <tbody>
              {data.maintenances.filter(m => m.status !== "termine").map(m => {
                const a = data.apartments.find(a => a.id === m.apartmentId);
                return (
                  <tr key={m.id}>
                    <td className="td-primary">{a?.name || "-"}</td>
                    <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description}</td>
                    <td><Badge status={m.priority} /></td>
                    <td><Badge status={m.status} /></td>
                  </tr>
                );
              })}
              {data.maintenances.filter(m => m.status !== "termine").length === 0 && (
                <tr><td colSpan={4}><div className="empty"><div className="empty-icon">✅</div><div className="empty-text">Aucune maintenance en cours</div></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Apartments ───────────────────────────────────────────────────────────────
function Apartments({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: "", address: "", city: "", zip: "", surface: "", rooms: "", rent: "", charges: "", status: "vacant", type: "appartement", floor: "", description: "" };
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (a) => { setEditing(a.id); setForm({ ...a }); setShowModal(true); };
  const save = () => {
    if (editing) {
      setData(d => ({ ...d, apartments: d.apartments.map(a => a.id === editing ? { ...form, id: editing, rent: +form.rent, charges: +form.charges, surface: +form.surface, rooms: +form.rooms, floor: +form.floor } : a) }));
    } else {
      setData(d => ({ ...d, apartments: [...d.apartments, { ...form, id: Date.now(), rent: +form.rent, charges: +form.charges, surface: +form.surface, rooms: +form.rooms, floor: +form.floor }] }));
    }
    setShowModal(false);
  };
  const del = (id) => { if (window.confirm("Supprimer cet appartement ?")) setData(d => ({ ...d, apartments: d.apartments.filter(a => a.id !== id) })); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalRevenu = data.apartments.filter(a => a.status === "loue").reduce((s, a) => s + a.rent + a.charges, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)", marginBottom: 4 }}>PORTEFEUILLE</div>
          <div style={{ fontSize: 13, color: "var(--t2)" }}>{data.apartments.length} bien(s) — Revenus potentiels : <span style={{ color: "var(--t1)", fontWeight: 700 }}>{fmt(totalRevenu)}/mois</span></div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Ajouter un bien</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Bien</th><th>Adresse</th><th>Type</th><th>Surface</th><th>Loyer HC</th><th>Charges</th><th>Total CC</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.apartments.map(a => (
              <tr key={a.id}>
                <td className="td-primary">{a.name}</td>
                <td>{a.address}, {a.zip} {a.city}</td>
                <td><span className="chip">{a.type}</span></td>
                <td className="td-mono">{a.surface} m² · {a.rooms}p</td>
                <td className="td-mono">{fmt(a.rent)}</td>
                <td className="td-mono">{fmt(a.charges)}</td>
                <td className="td-mono" style={{ color: "var(--t1)", fontWeight: 700 }}>{fmt(a.rent + a.charges)}</td>
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
            <div className="modal-title">{editing ? "Modifier le bien" : "Nouveau bien"}</div>
            <div className="modal-sub">{editing ? "Mise a jour des informations" : "Ajouter un bien a votre portefeuille"}</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nom / Reference</label><input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)} placeholder="Apt 101" /></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => upd("type", e.target.value)}>
                  <option value="appartement">Appartement</option>
                  <option value="studio">Studio</option>
                  <option value="maison">Maison</option>
                  <option value="commercial">Local commercial</option>
                  <option value="garage">Garage</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={form.address} onChange={e => upd("address", e.target.value)} placeholder="12 Rue de la Paix" /></div>
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
            <div className="form-group"><label className="form-label">Notes / Description</label><textarea className="form-input" value={form.description} onChange={e => upd("description", e.target.value)} rows={2} /></div>
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

// ─── Tenants ──────────────────────────────────────────────────────────────────
function Tenants({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: "", email: "", phone: "", apartmentId: "", leaseStart: "", leaseEnd: "", deposit: "", depositReturned: false, notes: "" };
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (t) => { setEditing(t.id); setForm({ ...t }); setShowModal(true); };
  const save = () => {
    if (editing) {
      setData(d => ({ ...d, tenants: d.tenants.map(t => t.id === editing ? { ...form, id: editing, apartmentId: +form.apartmentId, deposit: +form.deposit } : t) }));
    } else {
      setData(d => ({ ...d, tenants: [...d.tenants, { ...form, id: Date.now(), apartmentId: +form.apartmentId, deposit: +form.deposit }] }));
    }
    setShowModal(false);
  };
  const del = (id) => { if (window.confirm("Supprimer ce locataire ?")) setData(d => ({ ...d, tenants: d.tenants.filter(t => t.id !== id) })); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--t2)" }}>{data.tenants.length} locataire(s) actif(s)</div>
        <button className="btn btn-primary" onClick={openNew}>+ Nouveau locataire</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Locataire</th><th>Contact</th><th>Appartement</th><th>Debut bail</th><th>Fin bail</th><th>Depot</th><th>Expiration</th><th>Actions</th></tr></thead>
          <tbody>
            {data.tenants.map(t => {
              const apt = data.apartments.find(a => a.id === t.apartmentId);
              const days = daysUntil(t.leaseEnd);
              return (
                <tr key={t.id}>
                  <td className="td-primary">{t.name}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>{t.email}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{t.phone}</div>
                  </td>
                  <td>{apt?.name || "-"}</td>
                  <td className="td-mono">{fmtDate(t.leaseStart)}</td>
                  <td className="td-mono">{fmtDate(t.leaseEnd)}</td>
                  <td className="td-mono">{fmt(t.deposit)}</td>
                  <td>
                    {days < 0 ? <Badge status="en retard" /> :
                     days <= 30 ? <span style={{ color: "var(--red)", fontSize: 11, fontFamily: "var(--mono)" }}>{days}j</span> :
                     days <= 90 ? <span style={{ color: "var(--amber)", fontSize: 11, fontFamily: "var(--mono)" }}>{days}j</span> :
                     <span style={{ color: "var(--t3)", fontSize: 11, fontFamily: "var(--mono)" }}>{days}j</span>}
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
            <div className="modal-sub">Informations du bail</div>
            <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => upd("email", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e => upd("apartmentId", e.target.value)}>
                <option value="">-- Selectionner --</option>
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

// ─── Payments ─────────────────────────────────────────────────────────────────
function Payments({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [quittance, setQuittance] = useState(null);
  const emptyForm = { tenantId: "", apartmentId: "", amount: "", date: new Date().toISOString().split("T")[0], type: "Loyer + charges", status: "paye", method: "virement", reference: "" };
  const [form, setForm] = useState(emptyForm);

  const save = () => {
    setData(d => ({ ...d, payments: [...d.payments, { ...form, id: Date.now(), tenantId: +form.tenantId, apartmentId: +form.apartmentId, amount: +form.amount }] }));
    setShowModal(false);
  };
  const toggle = (id) => setData(d => ({ ...d, payments: d.payments.map(p => p.id === id ? { ...p, status: p.status === "paye" ? "en retard" : "paye" } : p) }));
  const del = (id) => { if (window.confirm("Supprimer ce paiement ?")) setData(d => ({ ...d, payments: d.payments.filter(p => p.id !== id) })); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openQuittance = (p) => {
    const t = data.tenants.find(t => t.id === p.tenantId);
    const a = data.apartments.find(a => a.id === p.apartmentId);
    if (t && a) setQuittance({ payment: p, tenant: t, apartment: a });
  };

  const totalPaye = data.payments.filter(p => p.status === "paye").reduce((s, p) => s + p.amount, 0);
  const totalRetard = data.payments.filter(p => p.status === "en retard").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>Total encaisse</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{fmt(totalPaye)}</div>
          </div>
          {totalRetard > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>En attente</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>{fmt(totalRetard)}</div>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ Enregistrer un paiement</button>
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
                  <td style={{ fontSize: 11 }}>{p.type}</td>
                  <td className="td-mono" style={{ color: "var(--t1)", fontWeight: 700 }}>{fmt(p.amount)}</td>
                  <td className="td-mono">{fmtDate(p.date)}</td>
                  <td><span className="chip">{p.method || "-"}</span></td>
                  <td className="td-mono" style={{ fontSize: 10 }}>{p.reference || "-"}</td>
                  <td><Badge status={p.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {p.status === "paye" && <button className="btn btn-ghost btn-sm" onClick={() => openQuittance(p)}>Quittance</button>}
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
            <div className="modal-sub">Loyer, charges, depot...</div>
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
                  <option>Loyer + charges</option><option>Loyer seul</option><option>Charges seules</option><option>Depot de garantie</option><option>Regularisation</option>
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
        <QuittanceModal
          payment={quittance.payment}
          tenant={quittance.tenant}
          apartment={quittance.apartment}
          owner={data.owner}
          onClose={() => setQuittance(null)}
        />
      )}
    </div>
  );
}

// ─── Maintenance ──────────────────────────────────────────────────────────────
function Maintenance({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptyForm = { apartmentId: "", description: "", date: new Date().toISOString().split("T")[0], status: "planifie", priority: "basse", cost: "", provider: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (m) => { setEditing(m.id); setForm({ ...m }); setShowModal(true); };
  const save = () => {
    if (editing) {
      setData(d => ({ ...d, maintenances: d.maintenances.map(m => m.id === editing ? { ...form, id: editing, apartmentId: +form.apartmentId, cost: +form.cost } : m) }));
    } else {
      setData(d => ({ ...d, maintenances: [...d.maintenances, { ...form, id: Date.now(), apartmentId: +form.apartmentId, cost: +form.cost }] }));
    }
    setShowModal(false);
  };
  const nextStatus = { "planifie": "en cours", "en cours": "termine", "termine": "planifie" };
  const advance = (id) => setData(d => ({ ...d, maintenances: d.maintenances.map(m => m.id === id ? { ...m, status: nextStatus[m.status] } : m) }));
  const del = (id) => { if (window.confirm("Supprimer cette intervention ?")) setData(d => ({ ...d, maintenances: d.maintenances.filter(m => m.id !== id) })); };
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalCout = data.maintenances.reduce((s, m) => s + (m.cost || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)", textTransform: "uppercase" }}>Cout total interventions</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{fmt(totalCout)}</div>
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
                  <td style={{ maxWidth: 200 }}>{m.description}</td>
                  <td style={{ fontSize: 11 }}>{m.provider || "-"}</td>
                  <td><Badge status={m.priority} /></td>
                  <td className="td-mono">{fmtDate(m.date)}</td>
                  <td className="td-mono">{m.cost ? fmt(m.cost) : "-"}</td>
                  <td><Badge status={m.status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => advance(m.id)}>Avancer</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>
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

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({ data, setData }) {
  const [form, setForm] = useState({ ...data.owner });
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    setData(d => ({ ...d, owner: { ...form } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetData = () => {
    if (window.confirm("Reinitialiser TOUTES les donnees ? Cette action est irreversible.")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 16 }}>Informations du proprietaire qui apparaissent sur les quittances</div>
        <div className="card" style={{ padding: 24 }}>
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
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={save}>{saved ? "✓ Sauvegarde !" : "Sauvegarder"}</button>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 24, borderColor: "rgba(239,68,68,0.2)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>Zone dangereuse</div>
        <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>Reinitialise toutes les donnees et repart des donnees exemple.</div>
        <button className="btn btn-danger" onClick={resetData}>Reinitialiser toutes les donnees</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Tableau de bord", icon: "📊" },
  { id: "apartments", label: "Appartements", icon: "🏠" },
  { id: "tenants", label: "Locataires", icon: "👥" },
  { id: "payments", label: "Paiements", icon: "💶" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
  { id: "settings", label: "Parametres", icon: "⚙️" },
];

const PAGE_TITLES = {
  dashboard: ["Tableau de bord", "Vue d'ensemble de votre patrimoine"],
  apartments: ["Appartements", "Gestion de votre portefeuille immobilier"],
  tenants: ["Locataires", "Gestion des baux et locataires"],
  payments: ["Paiements", "Suivi des loyers et encaissements"],
  maintenance: ["Maintenance", "Interventions et travaux"],
  settings: ["Parametres", "Configuration du compte proprietaire"],
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(loadData);

  // Auto-save on every change
  useEffect(() => { saveData(data); }, [data]);

  const lateCount = data.payments.filter(p => p.status === "en retard").length;
  const pages = { dashboard: Dashboard, apartments: Apartments, tenants: Tenants, payments: Payments, maintenance: Maintenance, settings: Settings };
  const Page = pages[page];
  const [title, sub] = PAGE_TITLES[page];
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-logo">
              <div className="brand-icon">🏢</div>
              <div className="brand-name">ImmoGest</div>
            </div>
            <div className="brand-tag">Pro v2.0</div>
          </div>
          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
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
            <div>
              <div className="topbar-title">{title}</div>
            </div>
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
