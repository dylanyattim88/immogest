import { useState, useEffect, createContext, useContext } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { supabase, TABLES } from "./supabaseClient";

const emptyData = {
  buildings: [],
  apartments: [],
  tenants: [],
  payments: [],
  maintenances: [],
  syndicCharges: [],
  charges: [],
  owner: { name: "", address: "", city: "", zip: "", email: "", phone: "", siret: "" },
};

// ── Devise ─────────────────────────────────────────────────────────────────────
// Toutes les valeurs monetaires sont stockees en FCFA (devise de reference).
// L'utilisateur peut choisir d'afficher/saisir en EUR : la conversion se fait a la volee.
export const EUR_TO_FCFA = 655.957;
export const CurrencyContext = createContext({ currency: "FCFA", setCurrency: () => {} });
// Convertit une valeur stockee (FCFA) vers l'unite d'affichage courante
export const toDisplay = (v, currency) => currency === "EUR" ? (Number(v) || 0) / EUR_TO_FCFA : (Number(v) || 0);
// Convertit une valeur saisie (dans l'unite d'affichage) vers le stockage (FCFA)
export const toStorage = (v, currency) => currency === "EUR" ? (Number(v) || 0) * EUR_TO_FCFA : (Number(v) || 0);

function fmt(nFcfa, currency = "FCFA") {
  const n = Number(nFcfa) || 0;
  if (currency === "EUR") return (n / EUR_TO_FCFA).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  return Math.round(n).toLocaleString("fr-FR") + " FCFA";
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR") : "-";
const monthName = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);
// ID unique : horodatage (ms) + composante aleatoire, pour eviter toute collision
// meme en cas de double-clic ou d'ajouts tres rapproches (Date.now() seul ne suffit pas).
const newId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

// ── Synchronisation Supabase (temps reel, partagee entre tous les utilisateurs) ─
// Chaque action (ajout/modif/suppression) declenche une operation Supabase ciblee et directe,
// sur la ligne concernee uniquement. Aucune comparaison globale entre "avant/apres" n'est faite :
// c'est ce qui provoquait le bug de suppressions en masse quand plusieurs onglets/appareils
// etaient ouverts en meme temps (un instantane perime pouvait etre interprete comme "a supprimer").
function useSupabaseData() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [b, a, t, p, m, s, c, o] = await Promise.all([
      supabase.from("buildings").select("*").order("id"),
      supabase.from("apartments").select("*").order("id"),
      supabase.from("tenants").select("*").order("id"),
      supabase.from("payments").select("*").order("id"),
      supabase.from("maintenances").select("*").order("id"),
      supabase.from("syndicCharges").select("*").order("id"),
      supabase.from("charges").select("*").order("id"),
      supabase.from("owner").select("*").eq("id", 1).maybeSingle(),
    ]);
    setData({
      buildings: b.data || [],
      apartments: a.data || [],
      tenants: t.data || [],
      payments: p.data || [],
      maintenances: m.data || [],
      syndicCharges: s.data || [],
      charges: c.data || [],
      owner: o.data || emptyData.owner,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("immogest-realtime");
    // Applique chaque changement recu (le sien ou celui d'un autre utilisateur/onglet) directement
    // sur la ligne concernee : jamais de remplacement en masse d'une table entiere.
    TABLES.forEach(table => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setData(d => {
          let arr = d[table];
          if (payload.eventType === "INSERT") {
            arr = arr.some(r => r.id === payload.new.id) ? arr.map(r => r.id === payload.new.id ? payload.new : r) : [...arr, payload.new];
          } else if (payload.eventType === "UPDATE") {
            arr = arr.map(r => r.id === payload.new.id ? payload.new : r);
          } else if (payload.eventType === "DELETE") {
            arr = arr.filter(r => r.id !== payload.old.id);
          }
          return { ...d, [table]: arr };
        });
      });
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "owner" }, (payload) => {
      setData(d => ({ ...d, owner: payload.eventType === "DELETE" ? emptyData.owner : payload.new }));
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Ajoute une ligne : mise a jour locale immediate (reactivite) + insertion Supabase ciblee.
  const addRow = (table, row) => {
    setData(d => d[table].some(r=>r.id===row.id) ? d : ({ ...d, [table]: [...d[table], row] }));
    supabase.from(table).insert(row).then(({ error }) => {
      if (error) {
        console.error(`insert ${table}`, error);
        alert("Erreur lors de l'enregistrement : " + error.message + "\n\nRecharge la page et reessaie.");
        setData(d => ({ ...d, [table]: d[table].filter(r=>r.id!==row.id) }));
      }
    });
  };
  // Modifie une ligne existante par son id, uniquement celle-la.
  const updateRow = (table, row) => {
    setData(d => ({ ...d, [table]: d[table].map(r => r.id === row.id ? row : r) }));
    supabase.from(table).update(row).eq("id", row.id).then(({ error }) => {
      if (error) { console.error(`update ${table}`, error); alert("Erreur lors de la modification : " + error.message); }
    });
  };
  // Supprime une ligne par son id, uniquement celle-la.
  const deleteRow = (table, id) => {
    setData(d => ({ ...d, [table]: d[table].filter(r => r.id !== id) }));
    supabase.from(table).delete().eq("id", id).then(({ error }) => {
      if (error) { console.error(`delete ${table}`, error); alert("Erreur lors de la suppression : " + error.message); }
    });
  };
  const saveOwner = (owner) => {
    setData(d => ({ ...d, owner }));
    supabase.from("owner").upsert({ ...owner, id: 1 }).then(({ error }) => { if (error) console.error("update owner", error); });
  };

  const resetAll = async () => {
    for (const table of TABLES) await supabase.from(table).delete().gte("id", 0);
    await fetchAll();
  };

  return { data, addRow, updateRow, deleteRow, saveOwner, loading, resetAll };
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f4f6f9;--white:#fff;--border:#e2e8f0;--border2:#cbd5e1;
  --accent:#2563eb;--accent-h:#1d4ed8;--accent-l:#eff6ff;--accent-l2:#dbeafe;
  --green:#16a34a;--green-l:#f0fdf4;--green-l2:#dcfce7;
  --red:#dc2626;--red-l:#fef2f2;--red-l2:#fecaca;
  --amber:#d97706;--amber-l:#fffbeb;--amber-l2:#fde68a;
  --purple:#7c3aed;--purple-l:#f5f3ff;--purple-l2:#ddd6fe;
  --t1:#0f172a;--t2:#334155;--t3:#64748b;--t4:#94a3b8;
  --sh:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
  --sh2:0 10px 25px rgba(0,0,0,.1);--r:8px;--r2:12px;
}
body{background:var(--bg);color:var(--t1);font-family:'Inter',sans-serif;font-size:14px;line-height:1.5;min-height:100vh}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
.app{display:flex;min-height:100vh}
.sidebar{width:230px;background:var(--t1);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100}
.sidebar-brand{padding:20px 20px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.brand-row{display:flex;align-items:center;gap:10px}
.brand-icon{width:34px;height:34px;background:var(--accent);border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.brand-name{font-size:17px;font-weight:700;color:#fff;letter-spacing:-.3px}
.brand-version{font-size:10px;color:rgba(255,255,255,.35);margin-top:2px}
.nav-group{padding:12px 12px 4px}
.nav-group-label{font-size:10px;font-weight:600;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:1px;padding:0 8px;margin-bottom:4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r);cursor:pointer;transition:background .15s;font-size:13px;font-weight:500;color:rgba(255,255,255,.55);margin-bottom:1px}
.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85)}
.nav-item.active{background:var(--accent);color:#fff}
.nav-icon{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px}
.sidebar-footer{margin-top:auto;padding:16px;border-top:1px solid rgba(255,255,255,.08)}
.sidebar-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sidebar-stat{background:rgba(255,255,255,.06);border-radius:var(--r);padding:10px;text-align:center}
.sidebar-stat-val{font-size:20px;font-weight:700;color:#fff}
.sidebar-stat-label{font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;margin-top:1px}
.main{margin-left:230px;flex:1;display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--white);border-bottom:1px solid var(--border);height:56px;display:flex;align-items:center;padding:0 28px;gap:12px;position:sticky;top:0;z-index:50;box-shadow:var(--sh)}
.topbar-title{font-size:16px;font-weight:700;color:var(--t1)}
.topbar-sep{color:var(--border2)}
.topbar-sub{font-size:13px;color:var(--t3)}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.topbar-date{font-size:12px;color:var(--t3);background:var(--bg);border:1px solid var(--border);padding:5px 12px;border-radius:6px}
.content{padding:24px 28px;flex:1}
.alert{display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:var(--r);font-size:13px;font-weight:500;margin-bottom:16px;border:1px solid}
.alert-red{background:var(--red-l);color:var(--red);border-color:var(--red-l2)}
.alert-amber{background:var(--amber-l);color:var(--amber);border-color:var(--amber-l2)}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.stat-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:18px 20px;box-shadow:var(--sh)}
.stat-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.stat-label{font-size:12px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px}
.stat-icon-wrap{width:36px;height:36px;border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-size:18px}
.stat-value{font-size:26px;font-weight:700;color:var(--t1);letter-spacing:-.5px;line-height:1}
.stat-delta{font-size:12px;color:var(--t3);margin-top:4px}
.stat-delta.green{color:var(--green)}
.stat-delta.red{color:var(--red)}
.card{background:var(--white);border:1px solid var(--border);border-radius:var(--r2);box-shadow:var(--sh);overflow:hidden;margin-bottom:16px}
.card-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--white)}
.card-title{font-size:14px;font-weight:700;color:var(--t1)}
.card-count{font-size:11px;font-weight:600;color:var(--t3);background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:20px}
.card-actions{margin-left:auto;display:flex;gap:8px}
table{width:100%;border-collapse:collapse}
th{font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;padding:10px 20px;text-align:left;border-bottom:1px solid var(--border);background:#fafbfc;white-space:nowrap}
td{padding:12px 20px;font-size:13px;color:var(--t2);border-bottom:1px solid var(--border);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:#fafbff}
.td-primary{color:var(--t1)!important;font-weight:600}
.td-mono{font-family:'Consolas',monospace;font-size:12px!important}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;flex-shrink:0}
.bg{background:var(--green-l2);color:var(--green)}.bg::before{background:var(--green)}
.br{background:var(--red-l2);color:var(--red)}.br::before{background:var(--red)}
.ba{background:var(--amber-l2);color:var(--amber)}.ba::before{background:var(--amber)}
.bb{background:var(--accent-l2);color:var(--accent)}.bb::before{background:var(--accent)}
.bp{background:var(--purple-l2);color:var(--purple)}.bp::before{background:var(--purple)}
.bn{background:var(--bg);color:var(--t3);border:1px solid var(--border)}.bn::before{background:var(--t4)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:'Inter',sans-serif;transition:all .15s;white-space:nowrap;line-height:1}
.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent-h)}
.btn-ghost{background:var(--white);color:var(--t2);border:1px solid var(--border)}.btn-ghost:hover{background:var(--bg);color:var(--t1)}
.btn-danger{background:var(--red-l);color:var(--red);border:1px solid var(--red-l2)}.btn-danger:hover{background:var(--red-l2)}
.btn-success{background:var(--green-l);color:var(--green);border:1px solid var(--green-l2)}
.btn-sm{padding:5px 10px;font-size:12px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);animation:fadeIn .15s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:28px;width:580px;max-width:100%;max-height:90vh;overflow-y:auto;animation:slideUp .2s ease;box-shadow:var(--sh2)}
.modal-lg{width:720px}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.modal-title{font-size:18px;font-weight:700;color:var(--t1);margin-bottom:4px}
.modal-sub{font-size:13px;color:var(--t3);margin-bottom:22px}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}
.form-group{margin-bottom:14px}
.form-label{display:block;font-size:12px;font-weight:600;color:var(--t2);margin-bottom:5px}
.form-input{width:100%;background:var(--white);border:1px solid var(--border2);border-radius:var(--r);padding:9px 12px;color:var(--t1);font-family:'Inter',sans-serif;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
.form-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
textarea.form-input{resize:vertical;min-height:70px}
.ring-wrap{position:relative;display:inline-block}
.ring-svg{transform:rotate(-90deg);display:block}
.ring-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.ring-pct{font-size:18px;font-weight:700;color:var(--t1);line-height:1}
.ring-lbl{font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;margin-top:2px}
.progress{background:var(--border);border-radius:4px;height:6px;overflow:hidden}
.progress-fill{height:100%;border-radius:4px;transition:width .5s ease}
.chart-bars{display:flex;align-items:flex-end;gap:8px;height:80px}
.chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
.chart-bar{width:100%;border-radius:4px 4px 0 0;min-height:4px;transition:height .4s ease}
.chart-label{font-size:10px;color:var(--t4);font-weight:500}
.empty{padding:40px;text-align:center}
.empty-icon{font-size:28px;margin-bottom:10px;opacity:.4}
.empty-text{font-size:13px;color:var(--t3)}
.chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500;background:var(--bg);color:var(--t3);border:1px solid var(--border)}
.filter-bar{display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px}
.filter-label{font-size:12px;font-weight:600;color:var(--t3)}
.filter-btn{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--t2);transition:all .15s}
.filter-btn.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.building-card{background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:20px;box-shadow:var(--sh);cursor:pointer;transition:all .2s}
.building-card:hover{border-color:var(--accent);box-shadow:0 4px 12px rgba(37,99,235,.1);transform:translateY(-1px)}
.building-card-name{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:4px}
.building-card-addr{font-size:12px;color:var(--t3);margin-bottom:12px}
.building-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px}
.building-stat{text-align:center;background:var(--bg);border-radius:6px;padding:8px 4px}
.building-stat-val{font-size:16px;font-weight:700;color:var(--t1)}
.building-stat-label{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px}
.quittance-preview{background:white;border:1px solid var(--border);border-radius:var(--r);padding:36px;font-family:Georgia,serif;color:#111;line-height:1.7}
.q-header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111}
.q-header h1{font-size:20px;font-weight:bold;letter-spacing:2px;text-transform:uppercase}
.q-header p{font-size:13px;color:#555;margin-top:4px}
.q-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
.q-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px;font-family:Arial,sans-serif}
.q-value{font-size:13px;line-height:1.6}
.q-total{background:#f8f9fa;border:1px solid #ddd;border-radius:6px;padding:18px 22px;margin:20px 0}
.q-total-label{font-size:12px;color:#666;font-family:Arial,sans-serif}
.q-total-amount{font-size:30px;font-weight:bold;margin-top:4px}
.q-total-detail{font-size:12px;color:#888;margin-top:6px;font-family:Arial,sans-serif}
.q-sign{display:flex;justify-content:space-between;margin-top:40px}
.q-sign-box{text-align:center;font-size:12px;color:#888;min-width:180px;font-family:Arial,sans-serif}
.q-sign-line{height:50px;border-bottom:1px solid #ccc;margin-bottom:8px}
.q-footer{margin-top:28px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center;font-family:Arial,sans-serif}
@media(max-width:1100px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
`;

function Badge({ status }) {
  const map = {
    "loue":["bg","Loue"],"paye":["bg","Paye"],"vacant":["bn","Vacant"],
    "en retard":["br","En retard"],"en cours":["ba","En cours"],
    "planifie":["bb","Planifie"],"termine":["bg","Termine"],
    "urgente":["br","Urgente"],"haute":["ba","Haute"],"basse":["bn","Basse"],
    "residentiel":["bb","Residentiel"],"mixte":["bp","Mixte"],"commercial":["ba","Commercial"],
    "a_payer":["bn","A payer"],"en_cours":["ba","En cours"],"en_retard":["br","En retard"],
  };
  const [cls, label] = map[status] || ["bn", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function RevenueChart({ payments }) {
  const { currency } = useContext(CurrencyContext);
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleDateString("fr-FR",{month:"short"});
    const total = payments.filter(p=>p.status==="paye"&&p.date.startsWith(key)).reduce((s,p)=>s+p.amount,0);
    months.push({label,total});
  }
  const maxVal = Math.max(...months.map(m=>m.total),1);
  return (
    <div style={{padding:"16px 20px 12px"}}>
      <div className="chart-bars">
        {months.map((m,i)=>(
          <div className="chart-bar-wrap" key={i}>
            <div className="chart-bar" style={{height:`${(m.total/maxVal)*100}%`,background:m.total>0?"var(--accent)":"var(--border)"}} title={fmt(m.total,currency)}/>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginTop:6}}>
        {months.map((m,i)=><div key={i} style={{flex:1,textAlign:"center"}} className="chart-label">{m.label}</div>)}
      </div>
    </div>
  );
}

function QuittanceModal({ payment, tenant, apartment, building, owner, onClose }) {
  const { currency } = useContext(CurrencyContext);
  const month = monthName(payment.date);
  const fullAddress = building ? `${apartment.name} — ${building.address}, ${building.zip} ${building.city}` : apartment.name;
  const periodLine = `Periode : ${month}` + (tenant.paymentFrequency && tenant.paymentFrequency!=="mensuel" ? ` — Paiement ${FREQUENCY_LABELS[tenant.paymentFrequency]?.toLowerCase()}` : "");

  const downloadPdf = () => {
    // jsPDF (polices standards) ne supporte pas l'espace fine insecable utilisee par
    // toLocaleString("fr-FR") pour separer les milliers : on la remplace par un espace normal.
    const pdfFmt = (n) => fmt(n,currency).replace(/[\u202F\u00A0]/g," ");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const marginX = 20;
    let y = 25;

    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.text("QUITTANCE DE LOYER", pageWidth/2, y, { align: "center" });
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(periodLine, pageWidth/2, y, { align: "center" });
    y += 5;
    doc.setDrawColor(20);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth-marginX, y);
    y += 12;

    const colWidth = (pageWidth - marginX*2 - 10)/2;
    const col1X = marginX, col2X = marginX + colWidth + 10;
    doc.setTextColor(140); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("BAILLEUR", col1X, y);
    doc.text("LOCATAIRE", col2X, y);
    y += 5;

    const ownerLines = [owner.name, owner.address, `${owner.zip} ${owner.city}`, owner.email, owner.phone].filter(Boolean);
    if (owner.siret) ownerLines.push(`SIRET : ${owner.siret}`);
    const tenantLines = [tenant.name, fullAddress];

    let y1 = y, y2 = y;
    doc.setTextColor(20); doc.setFontSize(10);
    ownerLines.forEach((line,i)=>{ doc.setFont("helvetica", i===0?"bold":"normal"); doc.text(String(line), col1X, y1, {maxWidth: colWidth}); y1+=5; });
    tenantLines.forEach((line,i)=>{ doc.setFont("helvetica", i===0?"bold":"normal"); doc.text(String(line), col2X, y2, {maxWidth: colWidth}); y2+=5; });
    y = Math.max(y1,y2) + 6;

    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(140);
    doc.text("BIEN LOUE", marginX, y);
    y += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(`${fullAddress} — ${apartment.surface} m2 — ${apartment.rooms} piece(s)`, marginX, y, {maxWidth: pageWidth-marginX*2});
    y += 10;

    const boxHeight = 30;
    doc.setFillColor(248,249,250);
    doc.setDrawColor(220);
    doc.roundedRect(marginX, y, pageWidth-marginX*2, boxHeight, 2, 2, "FD");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Somme recue de ${tenant.name} pour le mois de ${month}`, marginX+6, y+8);
    doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.setTextColor(20);
    doc.text(pdfFmt(payment.amount), marginX+6, y+18);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(140);
    let detailLine = `Dont loyer : ${pdfFmt(apartment.rent)} — Dont charges : ${pdfFmt(apartment.charges)}`;
    if (payment.method) detailLine += ` — Paiement par ${payment.method}`;
    if (payment.reference) detailLine += ` (${payment.reference})`;
    doc.text(detailLine, marginX+6, y+25, {maxWidth: pageWidth-marginX*2-12});
    y += boxHeight + 20;

    const sigWidth = 60;
    doc.setDrawColor(200);
    doc.line(marginX, y, marginX+sigWidth, y);
    doc.line(pageWidth-marginX-sigWidth, y, pageWidth-marginX, y);
    y += 5;
    doc.setFontSize(8); doc.setTextColor(140); doc.setFont("helvetica","normal");
    doc.text("Signature du bailleur", marginX, y);
    doc.text("Date d'emission", pageWidth-marginX-sigWidth, y);
    y += 5;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(50);
    doc.text(owner.name||"", marginX, y);
    doc.text(fmtDate(new Date().toISOString().split("T")[0]), pageWidth-marginX-sigWidth, y);

    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(170);
    doc.text("Document genere via ImmoGest — A valeur de recu de paiement de loyer", pageWidth/2, 285, {align:"center"});

    const safeName = (tenant.name||"locataire").replace(/[^a-z0-9]+/gi,"_");
    doc.save(`quittance-${safeName}-${payment.date}.pdf`);
  };

  const print = () => {
    const content = document.getElementById("quittance-content").innerHTML;
    const win = window.open("","_blank");
    win.document.write(`<html><head><title>Quittance ${month}</title>
    <style>
      body{font-family:Georgia,serif;padding:40px;color:#111;line-height:1.7;max-width:700px;margin:0 auto}
      .q-header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #111}
      .q-header h1{font-size:20px;font-weight:bold;letter-spacing:2px;text-transform:uppercase}
      .q-header p{font-size:13px;color:#555;margin-top:4px}
      .q-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
      .q-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px;font-family:Arial}
      .q-value{font-size:13px;line-height:1.6}
      .q-total{background:#f8f9fa;border:1px solid #ddd;border-radius:6px;padding:18px 22px;margin:20px 0}
      .q-total-label{font-size:12px;color:#666;font-family:Arial}
      .q-total-amount{font-size:30px;font-weight:bold;margin-top:4px}
      .q-total-detail{font-size:12px;color:#888;margin-top:6px;font-family:Arial}
      .q-sign{display:flex;justify-content:space-between;margin-top:40px}
      .q-sign-box{text-align:center;font-size:12px;color:#888;min-width:180px;font-family:Arial}
      .q-sign-line{height:50px;border-bottom:1px solid #ccc;margin-bottom:8px}
      .q-footer{margin-top:28px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center;font-family:Arial}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-title">Quittance de loyer</div>
        <div className="modal-sub">Apercu — telechargez le PDF ou imprimez directement</div>
        <div id="quittance-content" className="quittance-preview">
          <div className="q-header"><h1>Quittance de loyer</h1><p>{periodLine}</p></div>
          <div className="q-grid">
            <div><div className="q-label">Bailleur</div><div className="q-value"><strong>{owner.name}</strong><br/>{owner.address}<br/>{owner.zip} {owner.city}<br/>{owner.email}<br/>{owner.phone}{owner.siret&&<><br/>SIRET : {owner.siret}</>}</div></div>
            <div><div className="q-label">Locataire</div><div className="q-value"><strong>{tenant.name}</strong><br/>{fullAddress}</div></div>
          </div>
          <div style={{marginBottom:16}}><div className="q-label">Bien loue</div><div className="q-value">{fullAddress} — {apartment.surface} m² — {apartment.rooms} piece(s)</div></div>
          <div className="q-total">
            <div className="q-total-label">Somme recue de {tenant.name} pour le mois de {month}</div>
            <div className="q-total-amount">{fmt(payment.amount,currency)}</div>
            <div className="q-total-detail">Dont loyer : {fmt(apartment.rent,currency)} — Dont charges : {fmt(apartment.charges,currency)}{payment.method?` — Paiement par ${payment.method}`:""}{payment.reference?` (${payment.reference})`:""}</div>
          </div>
          <div className="q-sign">
            <div className="q-sign-box"><div className="q-sign-line"></div><div>Signature du bailleur</div><div style={{marginTop:4,fontWeight:"bold",color:"#333"}}>{owner.name}</div></div>
            <div className="q-sign-box"><div className="q-sign-line"></div><div>Date d'emission</div><div style={{marginTop:4,fontWeight:"bold",color:"#333"}}>{fmtDate(new Date().toISOString().split("T")[0])}</div></div>
          </div>
          <div className="q-footer">Document genere via ImmoGest — A valeur de recu de paiement de loyer</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
          <button className="btn btn-ghost" onClick={print}>Imprimer</button>
          <button className="btn btn-primary" onClick={downloadPdf}>⬇️ Telecharger le PDF</button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
const METHOD_LABELS = { virement: "Virement", cheque: "Cheque", especes: "Especes", prelevement: "Prelevement" };
function Dashboard({ data }) {
  const { currency } = useContext(CurrencyContext);
  const loue = data.apartments.filter(a=>a.status==="loue").length;
  const vacantApartments = data.apartments.filter(a=>a.status!=="loue");
  const totalRent = data.apartments.filter(a=>a.status==="loue").reduce((s,a)=>s+a.rent+a.charges,0);
  const late = data.payments.filter(p=>p.status==="en retard").length;
  const paidPayments = data.payments.filter(p=>p.status==="paye");
  const totalPaid = paidPayments.reduce((s,p)=>s+p.amount,0);
  const byMethod = {};
  paidPayments.forEach(p=>{ const k=p.method||"autre"; byMethod[k]=(byMethod[k]||0)+p.amount; });
  const expiring = data.tenants.filter(t=>{const d=daysUntil(t.leaseEnd);return d>=0&&d<=90;});
  const recentPayments = [...data.payments].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  // Stats par immeuble
  const buildingStats = data.buildings.map(b=>{
    const apts = data.apartments.filter(a=>a.buildingId===b.id);
    const loues = apts.filter(a=>a.status==="loue");
    const revenus = loues.reduce((s,a)=>s+a.rent+a.charges,0);
    return {...b, total:apts.length, loues:loues.length, revenus};
  });
  const buildingsWithRevenue = buildingStats.filter(b=>b.revenus>0);

  return (
    <div>
      {late>0&&<div className="alert alert-red">⚠️ {late} paiement(s) en retard — action requise</div>}
      {expiring.length>0&&<div className="alert alert-amber">📅 {expiring.length} bail(s) expirent dans moins de 90 jours : {expiring.map(t=>t.name).join(", ")}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Immeubles</span><div className="stat-icon-wrap" style={{background:"#f5f3ff"}}>🏢</div></div>
          <div className="stat-value">{data.buildings.length}</div>
          <div className="stat-delta">{data.apartments.length} appartements au total</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Occupation</span><div className="stat-icon-wrap" style={{background:"#eff6ff"}}>🏠</div></div>
          <div className="stat-value">{loue}<span style={{fontSize:16,color:"var(--t3)",fontWeight:500}}>/{data.apartments.length}</span></div>
          <div className="stat-delta">{data.apartments.length-loue} vacant(s)</div>
          {vacantApartments.length>0&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:2}}>
              {vacantApartments.map(a=>{
                const b=data.buildings.find(b=>b.id===a.buildingId);
                return (
                  <div key={a.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)"}}>
                    <span>{a.name}</span><span style={{fontWeight:600,color:"var(--t2)"}}>{b?.name||"-"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Revenus mensuels</span><div className="stat-icon-wrap" style={{background:"#f0fdf4"}}>💶</div></div>
          <div className="stat-value" style={{fontSize:20}}>{fmt(totalRent,currency)}</div>
          <div className="stat-delta green">Loyers + charges</div>
          {buildingsWithRevenue.length>0&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:2}}>
              {buildingsWithRevenue.map(b=>(
                <div key={b.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)"}}>
                  <span>{b.name}</span><span style={{fontWeight:600,color:"var(--t2)"}}>{fmt(b.revenus,currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Total encaisse</span><div className="stat-icon-wrap" style={{background:"#fffbeb"}}>📊</div></div>
          <div className="stat-value" style={{fontSize:20}}>{fmt(totalPaid,currency)}</div>
          <div className="stat-delta">Tous paiements</div>
          {Object.keys(byMethod).length>0&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:2}}>
              {Object.entries(byMethod).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)"}}>
                  <span>{METHOD_LABELS[k]||k}</span><span style={{fontWeight:600,color:"var(--t2)"}}>{fmt(v,currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats par immeuble */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-header"><span className="card-title">Performance par immeuble</span></div>
        <table>
          <thead><tr><th>Immeuble</th><th>Ville</th><th>Type</th><th>Appartements</th><th>Loues</th><th>Taux occ.</th><th>Revenus/mois</th></tr></thead>
          <tbody>
            {buildingStats.map(b=>(
              <tr key={b.id}>
                <td className="td-primary">{b.name}</td>
                <td>{b.city}</td>
                <td><Badge status={b.type}/></td>
                <td>{b.total}</td>
                <td>{b.loues}</td>
                <td>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="progress" style={{flex:1,maxWidth:80}}>
                      <div className="progress-fill" style={{width:b.total>0?`${(b.loues/b.total)*100}%`:"0%",background:"var(--accent)"}}/>
                    </div>
                    <span style={{fontSize:12,color:"var(--t2)",fontWeight:600}}>{b.total>0?Math.round((b.loues/b.total)*100):0}%</span>
                  </div>
                </td>
                <td className="td-mono" style={{fontWeight:700,color:"var(--green)"}}>{fmt(b.revenus,currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-header"><span className="card-title">Revenus — 6 derniers mois</span></div>
        <RevenueChart payments={data.payments}/>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header"><span className="card-title">Derniers paiements</span><span className="card-count">{recentPayments.length}</span></div>
          <table>
            <thead><tr><th>Locataire</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
            <tbody>
              {recentPayments.map(p=>{
                const t=data.tenants.find(t=>t.id===p.tenantId);
                return <tr key={p.id}><td className="td-primary">{t?.name||"-"}</td><td className="td-mono">{fmt(p.amount,currency)}</td><td className="td-mono">{fmtDate(p.date)}</td><td><Badge status={p.status}/></td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Maintenance active</span></div>
          <table>
            <thead><tr><th>Bien</th><th>Description</th><th>Priorite</th><th>Statut</th></tr></thead>
            <tbody>
              {data.maintenances.filter(m=>m.status!=="termine").map(m=>{
                const a=data.apartments.find(a=>a.id===m.apartmentId);
                return <tr key={m.id}><td className="td-primary">{a?.name||"-"}</td><td style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.description}</td><td><Badge status={m.priority}/></td><td><Badge status={m.status}/></td></tr>;
              })}
              {data.maintenances.filter(m=>m.status!=="termine").length===0&&<tr><td colSpan={4}><div className="empty"><div className="empty-icon">✅</div><div className="empty-text">Aucune maintenance active</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Buildings ──────────────────────────────────────────────────────────────────
function Buildings({ data, addRow, updateRow, deleteRow, setPage, setSelectedBuilding }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = {name:"",address:"",city:"",zip:"",floors:"",type:"residentiel",description:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const openNew = () => {setEditing(null);setForm(empty);setShowModal(true);};
  const openEdit = (b) => {setEditing(b.id);setForm({...b});setShowModal(true);};
  const save = () => {
    const parsed = {...form,floors:+form.floors};
    if (editing) updateRow("buildings",{...parsed,id:editing});
    else addRow("buildings",{...parsed,id:newId()});
    setShowModal(false);
  };
  const del = (id) => {
    if (data.apartments.some(a=>a.buildingId===id)) { alert("Supprimez d'abord les appartements de cet immeuble."); return; }
    if (window.confirm("Supprimer cet immeuble ?")) deleteRow("buildings",id);
  };

  const getBuildingStats = (b) => {
    const apts = data.apartments.filter(a=>a.buildingId===b.id);
    const loues = apts.filter(a=>a.status==="loue");
    const revenus = loues.reduce((s,a)=>s+a.rent+a.charges,0);
    const maints = data.maintenances.filter(m=>apts.some(a=>a.id===m.apartmentId)&&m.status!=="termine");
    return {total:apts.length,loues:loues.length,revenus,maints:maints.length};
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:13,color:"var(--t2)"}}><strong style={{color:"var(--t1)"}}>{data.buildings.length}</strong> immeuble(s) dans votre portefeuille</div>
        <button className="btn btn-primary" onClick={openNew}>+ Ajouter un immeuble</button>
      </div>

      <div className="three-col">
        {data.buildings.map(b=>{
          const stats = getBuildingStats(b);
          return (
            <div key={b.id} className="building-card" onClick={()=>{setSelectedBuilding(b.id);setPage("apartments");}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div className="building-card-name">🏢 {b.name}</div>
                  <div className="building-card-addr">{b.address}, {b.zip} {b.city}</div>
                </div>
                <Badge status={b.type}/>
              </div>
              <div style={{fontSize:12,color:"var(--t3)",marginBottom:8}}>{b.floors} etage(s)</div>
              <div className="progress" style={{marginBottom:8}}>
                <div className="progress-fill" style={{width:stats.total>0?`${(stats.loues/stats.total)*100}%`:"0%",background:"var(--accent)"}}/>
              </div>
              <div className="building-stats">
                <div className="building-stat">
                  <div className="building-stat-val">{stats.total}</div>
                  <div className="building-stat-label">Apts</div>
                </div>
                <div className="building-stat">
                  <div className="building-stat-val" style={{color:"var(--green)"}}>{stats.loues}</div>
                  <div className="building-stat-label">Loues</div>
                </div>
                <div className="building-stat">
                  <div className="building-stat-val" style={{color:stats.maints>0?"var(--amber)":"var(--t1)"}}>{stats.maints}</div>
                  <div className="building-stat-label">Travaux</div>
                </div>
              </div>
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700,color:"var(--green)"}}>{fmt(stats.revenus,currency)}/mois</span>
                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(b)}>Editer</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>del(b.id)}>Suppr.</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier l'immeuble":"Nouvel immeuble"}</div>
            <div className="modal-sub">Informations de l'immeuble</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nom de l'immeuble</label><input className="form-input" value={form.name} onChange={e=>upd("name",e.target.value)} placeholder="Residence Les Lilas"/></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e=>upd("type",e.target.value)}>
                  <option value="residentiel">Residentiel</option>
                  <option value="mixte">Mixte</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={form.address} onChange={e=>upd("address",e.target.value)}/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Ville</label><input className="form-input" value={form.city} onChange={e=>upd("city",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Code postal</label><input className="form-input" value={form.zip} onChange={e=>upd("zip",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Nombre d'etages</label><input className="form-input" type="number" value={form.floors} onChange={e=>upd("floors",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.description} onChange={e=>upd("description",e.target.value)} rows={2}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Apartments ─────────────────────────────────────────────────────────────────
function Apartments({ data, addRow, updateRow, deleteRow, selectedBuilding, setSelectedBuilding }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = {buildingId:"",name:"",surface:"",rooms:"",rent:"",charges:"",status:"vacant",type:"appartement",floor:"",description:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const filtered = selectedBuilding ? data.apartments.filter(a=>a.buildingId===selectedBuilding) : data.apartments;

  const openNew = () => {setEditing(null);setForm({...empty,buildingId:selectedBuilding||""});setShowModal(true);};
  const openEdit = (a) => {setEditing(a.id);setForm({...a,rent:toDisplay(a.rent,currency),charges:toDisplay(a.charges,currency)});setShowModal(true);};
  const save = () => {
    const parsed = {...form,buildingId:+form.buildingId,rent:toStorage(form.rent,currency),charges:toStorage(form.charges,currency),surface:+form.surface,rooms:+form.rooms,floor:+form.floor};
    if (editing) updateRow("apartments",{...parsed,id:editing});
    else addRow("apartments",{...parsed,id:newId()});
    setShowModal(false);
  };
  const del = (id) => {if(window.confirm("Supprimer cet appartement ?"))deleteRow("apartments",id);};

  const selectedBuildingObj = selectedBuilding ? data.buildings.find(b=>b.id===selectedBuilding) : null;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:"var(--t2)"}}><strong style={{color:"var(--t1)"}}>{filtered.length}</strong> bien(s)</div>
        <button className="btn btn-primary" onClick={openNew}>+ Ajouter un bien</button>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Immeuble :</span>
        <button className={`filter-btn ${!selectedBuilding?"active":""}`} onClick={()=>setSelectedBuilding(null)}>Tous</button>
        {data.buildings.map(b=>(
          <button key={b.id} className={`filter-btn ${selectedBuilding===b.id?"active":""}`} onClick={()=>setSelectedBuilding(b.id)}>{b.name}</button>
        ))}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Reference</th><th>Immeuble</th><th>Type</th><th>Surface</th><th>Loyer HC</th><th>Charges</th><th>Total CC</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(a=>{
              const b=data.buildings.find(b=>b.id===a.buildingId);
              return (
                <tr key={a.id}>
                  <td className="td-primary">{a.name}</td>
                  <td>{b?.name||"-"} <span style={{fontSize:11,color:"var(--t3)"}}>{b?.city}</span></td>
                  <td><span className="chip">{a.type}</span></td>
                  <td>{a.surface} m² · {a.rooms}p</td>
                  <td className="td-mono">{fmt(a.rent,currency)}</td>
                  <td className="td-mono">{fmt(a.charges,currency)}</td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--t1)"}}>{fmt(a.rent+a.charges,currency)}</td>
                  <td><Badge status={a.status}/></td>
                  <td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>openEdit(a)}>Editer</button><button className="btn btn-danger btn-sm" onClick={()=>del(a.id)}>Suppr.</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier le bien":"Ajouter un bien"}</div>
            <div className="modal-sub">Rattacher l'appartement a un immeuble</div>
            <div className="form-group"><label className="form-label">Immeuble</label>
              <select className="form-input" value={form.buildingId} onChange={e=>upd("buildingId",e.target.value)}>
                <option value="">-- Selectionner un immeuble --</option>
                {data.buildings.map(b=><option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nom / Reference</label><input className="form-input" value={form.name} onChange={e=>upd("name",e.target.value)} placeholder="Apt 101"/></div>
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e=>upd("type",e.target.value)}>
                  <option value="appartement">Appartement</option><option value="studio">Studio</option><option value="maison">Maison</option><option value="commercial">Local commercial</option><option value="garage">Garage</option>
                </select>
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">Surface (m²)</label><input className="form-input" type="number" value={form.surface} onChange={e=>upd("surface",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Pieces</label><input className="form-input" type="number" value={form.rooms} onChange={e=>upd("rooms",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Etage</label><input className="form-input" type="number" value={form.floor} onChange={e=>upd("floor",e.target.value)}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Loyer HC ({currency})</label><input className="form-input" type="number" value={form.rent} onChange={e=>upd("rent",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Charges ({currency})</label><input className="form-input" type="number" value={form.charges} onChange={e=>upd("charges",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Statut</label>
              <select className="form-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
                <option value="loue">Loue</option><option value="vacant">Vacant</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.description} onChange={e=>upd("description",e.target.value)} rows={2}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tenants ────────────────────────────────────────────────────────────────────
const FREQUENCY_LABELS = { mensuel: "Mensuel", trimestriel: "Trimestriel", semestriel: "Semestriel", annuel: "Annuel" };
function Tenants({ data, addRow, updateRow, deleteRow }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterBuilding, setFilterBuilding] = useState(null);
  const empty = {name:"",email:"",phone:"",apartmentId:"",leaseStart:"",leaseEnd:"",deposit:"",paymentFrequency:"mensuel",notes:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const filteredApts = filterBuilding ? data.apartments.filter(a=>a.buildingId===filterBuilding) : data.apartments;
  const filteredTenants = data.tenants.filter(t=>filteredApts.some(a=>a.id===t.apartmentId));

  const save = () => {
    const parsed = {...form,apartmentId:+form.apartmentId,deposit:toStorage(form.deposit,currency)};
    if (editing) updateRow("tenants",{...parsed,id:editing});
    else addRow("tenants",{...parsed,id:newId()});
    setShowModal(false);
  };
  const del = (id) => {if(window.confirm("Supprimer ce locataire ?"))deleteRow("tenants",id);};
  const openEdit = (t) => {setEditing(t.id);setForm({...t,deposit:toDisplay(t.deposit,currency),paymentFrequency:t.paymentFrequency||"mensuel"});setShowModal(true);};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:13,color:"var(--t2)"}}><strong style={{color:"var(--t1)"}}>{filteredTenants.length}</strong> locataire(s)</div>
        <button className="btn btn-primary" onClick={()=>{setEditing(null);setForm(empty);setShowModal(true);}}>+ Nouveau locataire</button>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Immeuble :</span>
        <button className={`filter-btn ${!filterBuilding?"active":""}`} onClick={()=>setFilterBuilding(null)}>Tous</button>
        {data.buildings.map(b=><button key={b.id} className={`filter-btn ${filterBuilding===b.id?"active":""}`} onClick={()=>setFilterBuilding(b.id)}>{b.name}</button>)}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Nom</th><th>Contact</th><th>Appartement</th><th>Immeuble</th><th>Frequence</th><th>Fin bail</th><th>Depot</th><th>Expiration</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredTenants.map(t=>{
              const apt=data.apartments.find(a=>a.id===t.apartmentId);
              const b=apt?data.buildings.find(b=>b.id===apt.buildingId):null;
              const days=daysUntil(t.leaseEnd);
              const renewalSoon = days>=0 && days<=60;
              return (
                <tr key={t.id}>
                  <td className="td-primary">{t.name}</td>
                  <td><div style={{fontSize:13}}>{t.email}</div><div style={{fontSize:11,color:"var(--t3)"}}>{t.phone}</div></td>
                  <td>{apt?.name||"-"}</td>
                  <td style={{fontSize:12,color:"var(--t3)"}}>{b?.name||"-"}</td>
                  <td><span className="chip">{FREQUENCY_LABELS[t.paymentFrequency]||"Mensuel"}</span></td>
                  <td className="td-mono">
                    {fmtDate(t.leaseEnd)}
                    {renewalSoon&&<div style={{marginTop:3}}><span className="badge ba" title="Le bail arrive a echeance dans moins de 2 mois">🔔 Renouvellement a anticiper</span></div>}
                  </td>
                  <td className="td-mono">{fmt(t.deposit,currency)}</td>
                  <td>{days<0?<Badge status="en retard"/>:days<=30?<span style={{color:"var(--red)",fontSize:12,fontWeight:600}}>{days}j</span>:days<=90?<span style={{color:"var(--amber)",fontSize:12,fontWeight:600}}>{days}j</span>:<span style={{color:"var(--t3)",fontSize:12}}>{days}j</span>}</td>
                  <td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>openEdit(t)}>Editer</button><button className="btn btn-danger btn-sm" onClick={()=>del(t.id)}>Suppr.</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier le locataire":"Nouveau locataire"}</div>
            <div className="modal-sub">Informations du bail</div>
            <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e=>upd("name",e.target.value)}/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e=>upd("phone",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e=>upd("apartmentId",e.target.value)}>
                <option value="">-- Selectionner --</option>
                {data.apartments.map(a=>{const b=data.buildings.find(b=>b.id===a.buildingId);return <option key={a.id} value={a.id}>{a.name} — {b?.name}</option>;})}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Debut du bail</label><input className="form-input" type="date" value={form.leaseStart} onChange={e=>upd("leaseStart",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Fin du bail</label><input className="form-input" type="date" value={form.leaseEnd} onChange={e=>upd("leaseEnd",e.target.value)}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Depot de garantie ({currency})</label><input className="form-input" type="number" value={form.deposit} onChange={e=>upd("deposit",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Frequence de paiement</label>
                <select className="form-input" value={form.paymentFrequency} onChange={e=>upd("paymentFrequency",e.target.value)}>
                  <option value="mensuel">Mensuel</option>
                  <option value="trimestriel">Trimestriel</option>
                  <option value="semestriel">Semestriel</option>
                  <option value="annuel">Annuel</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" value={form.notes} onChange={e=>upd("notes",e.target.value)} rows={2}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payments ───────────────────────────────────────────────────────────────────
function Payments({ data, addRow, updateRow, deleteRow }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [quittance, setQuittance] = useState(null);
  const [filterBuilding, setFilterBuilding] = useState(null);
  const [view, setView] = useState("liste");
  const empty = {tenantId:"",apartmentId:"",amount:"",date:new Date().toISOString().split("T")[0],type:"Loyer + charges",status:"paye",method:"virement",reference:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const filteredApts = filterBuilding ? data.apartments.filter(a=>a.buildingId===filterBuilding) : data.apartments;
  const filteredPayments = data.payments.filter(p=>filteredApts.some(a=>a.id===p.apartmentId));

  const save = () => {
    addRow("payments",{...form,id:newId(),tenantId:+form.tenantId,apartmentId:+form.apartmentId,amount:toStorage(form.amount,currency)});
    setShowModal(false);
  };
  const toggle = (p) => updateRow("payments",{...p,status:p.status==="paye"?"en retard":"paye"});
  const del = (id) => {if(window.confirm("Supprimer ce paiement ?"))deleteRow("payments",id);};

  const openQuittance = (p) => {
    const t=data.tenants.find(t=>t.id===p.tenantId);
    const a=data.apartments.find(a=>a.id===p.apartmentId);
    const b=a?data.buildings.find(b=>b.id===a.buildingId):null;
    if(t&&a) setQuittance({payment:p,tenant:t,apartment:a,building:b});
  };

  const totalPaye = filteredPayments.filter(p=>p.status==="paye").reduce((s,p)=>s+p.amount,0);
  const totalRetard = filteredPayments.filter(p=>p.status==="en retard").reduce((s,p)=>s+p.amount,0);

  // Recap par mois
  const monthlyMap = {};
  filteredPayments.forEach(p=>{
    const key = p.date ? p.date.slice(0,7) : "inconnu"; // YYYY-MM
    if(!monthlyMap[key]) monthlyMap[key] = {key, paye:0, retard:0, count:0};
    monthlyMap[key].count += 1;
    if(p.status==="paye") monthlyMap[key].paye += p.amount;
    else if(p.status==="en retard") monthlyMap[key].retard += p.amount;
  });
  const monthlyRecap = Object.values(monthlyMap).sort((a,b)=>b.key.localeCompare(a.key));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:24}}>
          <div><div style={{fontSize:11,fontWeight:600,color:"var(--t3)",textTransform:"uppercase"}}>Total encaisse</div><div style={{fontSize:22,fontWeight:700,color:"var(--green)"}}>{fmt(totalPaye,currency)}</div></div>
          {totalRetard>0&&<div><div style={{fontSize:11,fontWeight:600,color:"var(--t3)",textTransform:"uppercase"}}>En attente</div><div style={{fontSize:22,fontWeight:700,color:"var(--red)"}}>{fmt(totalRetard,currency)}</div></div>}
        </div>
        <button className="btn btn-primary" onClick={()=>{setForm(empty);setShowModal(true);}}>+ Enregistrer un paiement</button>
      </div>

      <div className="filter-bar" style={{justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span className="filter-label">Immeuble :</span>
          <button className={`filter-btn ${!filterBuilding?"active":""}`} onClick={()=>setFilterBuilding(null)}>Tous</button>
          {data.buildings.map(b=><button key={b.id} className={`filter-btn ${filterBuilding===b.id?"active":""}`} onClick={()=>setFilterBuilding(b.id)}>{b.name}</button>)}
        </div>
        <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
          <button onClick={()=>setView("liste")} style={{padding:"5px 12px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:view==="liste"?"var(--accent)":"var(--white)",color:view==="liste"?"#fff":"var(--t2)"}}>Liste</button>
          <button onClick={()=>setView("mois")} style={{padding:"5px 12px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:view==="mois"?"var(--accent)":"var(--white)",color:view==="mois"?"#fff":"var(--t2)"}}>Par mois</button>
        </div>
      </div>

      {view==="mois"?(
        <div className="card">
          <table>
            <thead><tr><th>Mois</th><th>Nb paiements</th><th>Encaisse</th><th>En attente</th></tr></thead>
            <tbody>
              {monthlyRecap.map(m=>(
                <tr key={m.key}>
                  <td className="td-primary" style={{textTransform:"capitalize"}}>{m.key==="inconnu"?"Date inconnue":monthName(m.key+"-01")}</td>
                  <td className="td-mono">{m.count}</td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--green)"}}>{fmt(m.paye,currency)}</td>
                  <td className="td-mono" style={{fontWeight:700,color:m.retard>0?"var(--red)":"var(--t3)"}}>{m.retard>0?fmt(m.retard,currency):"-"}</td>
                </tr>
              ))}
              {monthlyRecap.length===0&&<tr><td colSpan={4}><div className="empty"><div className="empty-icon">📅</div><div className="empty-text">Aucun paiement enregistre</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      ):(
      <div className="card">
        <table>
          <thead><tr><th>Locataire</th><th>Appartement</th><th>Immeuble</th><th>Montant</th><th>Date</th><th>Methode</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {[...filteredPayments].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(p=>{
              const t=data.tenants.find(t=>t.id===p.tenantId);
              const a=data.apartments.find(a=>a.id===p.apartmentId);
              const b=a?data.buildings.find(b=>b.id===a.buildingId):null;
              return (
                <tr key={p.id}>
                  <td className="td-primary">{t?.name||"-"}</td>
                  <td>{a?.name||"-"}</td>
                  <td style={{fontSize:12,color:"var(--t3)"}}>{b?.name||"-"}</td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--t1)"}}>{fmt(p.amount,currency)}</td>
                  <td className="td-mono">{fmtDate(p.date)}</td>
                  <td><span className="chip">{p.method||"-"}</span></td>
                  <td><Badge status={p.status}/></td>
                  <td>
                    <div style={{display:"flex",gap:5}}>
                      {p.status==="paye"&&<button className="btn btn-success btn-sm" onClick={()=>openQuittance(p)}>Quittance</button>}
                      <button className="btn btn-ghost btn-sm" onClick={()=>toggle(p)}>Basculer</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>del(p.id)}>X</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Enregistrer un paiement</div>
            <div className="modal-sub">Loyer, charges, depot...</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Locataire</label>
                <select className="form-input" value={form.tenantId} onChange={e=>upd("tenantId",e.target.value)}>
                  <option value="">-- Selectionner --</option>
                  {data.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Appartement</label>
                <select className="form-input" value={form.apartmentId} onChange={e=>upd("apartmentId",e.target.value)}>
                  <option value="">-- Selectionner --</option>
                  {data.apartments.map(a=>{const b=data.buildings.find(b=>b.id===a.buildingId);return <option key={a.id} value={a.id}>{a.name} — {b?.name}</option>;})}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Montant ({currency})</label><input className="form-input" type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e=>upd("date",e.target.value)}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e=>upd("type",e.target.value)}>
                  <option>Loyer + charges</option><option>Loyer seul</option><option>Charges seules</option><option>Depot de garantie</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Methode</label>
                <select className="form-input" value={form.method} onChange={e=>upd("method",e.target.value)}>
                  <option value="virement">Virement</option><option value="cheque">Cheque</option><option value="especes">Especes</option><option value="prelevement">Prelevement</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Reference</label><input className="form-input" value={form.reference} onChange={e=>upd("reference",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
                  <option value="paye">Paye</option><option value="en retard">En retard</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      {quittance&&<QuittanceModal {...quittance} owner={data.owner} onClose={()=>setQuittance(null)}/>}
    </div>
  );
}

// ── Maintenance ────────────────────────────────────────────────────────────────
function Maintenance({ data, addRow, updateRow, deleteRow }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterBuilding, setFilterBuilding] = useState(null);
  const empty = {apartmentId:"",description:"",date:new Date().toISOString().split("T")[0],status:"planifie",priority:"basse",cost:"",provider:"",notes:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const filteredApts = filterBuilding ? data.apartments.filter(a=>a.buildingId===filterBuilding) : data.apartments;
  const filteredMaints = data.maintenances
    .filter(m=>filteredApts.some(a=>a.id===m.apartmentId))
    .sort((a,b)=>{
      const aDone = a.status==="termine" ? 1 : 0;
      const bDone = b.status==="termine" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone; // termine toujours a la fin
      return new Date(b.date) - new Date(a.date); // sinon plus recent d'abord
    });

  const save = () => {
    const parsed = {...form,apartmentId:+form.apartmentId,cost:toStorage(form.cost,currency)};
    if(editing) updateRow("maintenances",{...parsed,id:editing});
    else addRow("maintenances",{...parsed,id:newId()});
    setShowModal(false);
  };
  const next = {"planifie":"en cours","en cours":"termine","termine":"planifie"};
  const advance = (m) => updateRow("maintenances",{...m,status:next[m.status]});
  const del = (id) => {if(window.confirm("Supprimer ?"))deleteRow("maintenances",id);};
  const openEdit = (m) => {setEditing(m.id);setForm({...m,cost:toDisplay(m.cost,currency)});setShowModal(true);};

  const totalCout = filteredMaints.reduce((s,m)=>s+(m.cost||0),0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><div style={{fontSize:11,fontWeight:600,color:"var(--t3)",textTransform:"uppercase"}}>Cout total</div><div style={{fontSize:22,fontWeight:700,color:"var(--amber)"}}>{fmt(totalCout,currency)}</div></div>
        <button className="btn btn-primary" onClick={()=>{setEditing(null);setForm(empty);setShowModal(true);}}>+ Signaler une intervention</button>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Immeuble :</span>
        <button className={`filter-btn ${!filterBuilding?"active":""}`} onClick={()=>setFilterBuilding(null)}>Tous</button>
        {data.buildings.map(b=><button key={b.id} className={`filter-btn ${filterBuilding===b.id?"active":""}`} onClick={()=>setFilterBuilding(b.id)}>{b.name}</button>)}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Appartement</th><th>Immeuble</th><th>Description</th><th>Priorite</th><th>Date</th><th>Cout</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredMaints.map(m=>{
              const a=data.apartments.find(a=>a.id===m.apartmentId);
              const b=a?data.buildings.find(b=>b.id===a.buildingId):null;
              return (
                <tr key={m.id}>
                  <td className="td-primary">{a?.name||"-"}</td>
                  <td style={{fontSize:12,color:"var(--t3)"}}>{b?.name||"-"}</td>
                  <td style={{maxWidth:180}}>{m.description}</td>
                  <td><Badge status={m.priority}/></td>
                  <td className="td-mono">{fmtDate(m.date)}</td>
                  <td className="td-mono">{m.cost?fmt(m.cost,currency):"-"}</td>
                  <td><Badge status={m.status}/></td>
                  <td><div style={{display:"flex",gap:5}}><button className="btn btn-ghost btn-sm" onClick={()=>advance(m)}>Avancer</button><button className="btn btn-ghost btn-sm" onClick={()=>openEdit(m)}>Editer</button><button className="btn btn-danger btn-sm" onClick={()=>del(m.id)}>X</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier":"Nouvelle intervention"}</div>
            <div className="modal-sub">Suivi des travaux</div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e=>upd("apartmentId",e.target.value)}>
                <option value="">-- Selectionner --</option>
                {data.apartments.map(a=>{const b=data.buildings.find(b=>b.id===a.buildingId);return <option key={a.id} value={a.id}>{a.name} — {b?.name}</option>;})}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e=>upd("description",e.target.value)}/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Priorite</label>
                <select className="form-input" value={form.priority} onChange={e=>upd("priority",e.target.value)}>
                  <option value="urgente">Urgente</option><option value="haute">Haute</option><option value="basse">Basse</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
                  <option value="planifie">Planifie</option><option value="en cours">En cours</option><option value="termine">Termine</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Prestataire</label><input className="form-input" value={form.provider} onChange={e=>upd("provider",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Cout ({currency})</label><input className="form-input" type="number" value={form.cost} onChange={e=>upd("cost",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e=>upd("date",e.target.value)}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Charges par immeuble (electricite, eau, assurance, taxes, gardiennage...) ──
const CHARGE_CATEGORIES = ["Electricite","Eau","Assurance","Taxes foncieres","Gardiennage","Nettoyage","Ascenseur","Internet","Autre"];
// ── Camembert SVG (leger, sans librairie externe) ───────────────────────────────
const CATEGORY_COLORS = {
  "Electricite":"#f59e0b","Eau":"#3b82f6","Assurance":"#8b5cf6","Taxes foncieres":"#ef4444",
  "Gardiennage":"#10b981","Nettoyage":"#06b6d4","Ascenseur":"#f97316","Internet":"#6366f1","Autre":"#94a3b8",
};
function PieChart({ data, size = 160 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  if (total<=0) return <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--t3)"}}>Aucune donnee</div>;
  const r = size/2;
  const nonZero = data.filter(d=>d.value>0);
  if (nonZero.length===1) {
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={r} cy={r} r={r} fill={nonZero[0].color}/></svg>;
  }
  let cumulative = 0;
  const slices = nonZero.map(d=>{
    const startAngle = (cumulative/total)*2*Math.PI;
    cumulative += d.value;
    const endAngle = (cumulative/total)*2*Math.PI;
    const x1 = r + r*Math.sin(startAngle), y1 = r - r*Math.cos(startAngle);
    const x2 = r + r*Math.sin(endAngle), y2 = r - r*Math.cos(endAngle);
    const largeArc = endAngle-startAngle > Math.PI ? 1 : 0;
    return { color:d.color, path: `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1"/>)}
    </svg>
  );
}

function ChargesPage({ data, addRow, updateRow, deleteRow }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterBuilding, setFilterBuilding] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const empty = {buildingId:"",category:"Electricite",amount:"",date:new Date().toISOString().split("T")[0],notes:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const years = [...new Set(data.charges.map(c=>c.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);

  const filtered = data.charges.filter(c=>
    (!filterBuilding || c.buildingId===filterBuilding) &&
    (!filterYear || c.date?.slice(0,4)===filterYear)
  );

  const save = () => {
    const parsed = {...form,buildingId:+form.buildingId,amount:toStorage(form.amount,currency)};
    if (editing) updateRow("charges",{...parsed,id:editing});
    else addRow("charges",{...parsed,id:newId()});
    setShowModal(false);
  };
  const del = (id) => {if(window.confirm("Supprimer cette charge ?"))deleteRow("charges",id);};
  const openNew = () => {setEditing(null);setForm({...empty,buildingId:filterBuilding||""});setShowModal(true);};
  const openEdit = (c) => {setEditing(c.id);setForm({...c,amount:toDisplay(c.amount,currency)});setShowModal(true);};

  const total = filtered.reduce((s,c)=>s+c.amount,0);

  // Repartition par immeuble (pertinente quand aucun immeuble specifique n'est selectionne)
  const byBuilding = data.buildings.map(b=>{
    const rows = filtered.filter(c=>c.buildingId===b.id);
    return {...b, total: rows.reduce((s,c)=>s+c.amount,0), count: rows.length};
  }).filter(b=>b.count>0);

  // Repartition par annee
  const byYear = {};
  filtered.forEach(c=>{ const y=c.date?.slice(0,4)||"?"; byYear[y]=(byYear[y]||0)+c.amount; });
  const byYearRows = Object.entries(byYear).sort((a,b)=>b[0].localeCompare(a[0]));

  // Repartition par categorie (pour le camembert)
  const byCategory = {};
  filtered.forEach(c=>{ const k=c.category||"Autre"; byCategory[k]=(byCategory[k]||0)+c.amount; });
  const categoryRows = Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const pieData = categoryRows.map(([label,value])=>({label,value,color:CATEGORY_COLORS[label]||"#94a3b8"}));

  // Repartition par mois
  const byMonth = {};
  filtered.forEach(c=>{ const k=c.date?c.date.slice(0,7):"inconnu"; byMonth[k]=(byMonth[k]||0)+c.amount; });
  const monthRows = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0]));

  return (
    <div>
      <div className="filter-bar" style={{justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span className="filter-label">Immeuble :</span>
          <button className={`filter-btn ${!filterBuilding?"active":""}`} onClick={()=>setFilterBuilding(null)}>Tous</button>
          {data.buildings.map(b=><button key={b.id} className={`filter-btn ${filterBuilding===b.id?"active":""}`} onClick={()=>setFilterBuilding(b.id)}>{b.name}</button>)}
          <span className="filter-label" style={{marginLeft:10}}>Annee :</span>
          <button className={`filter-btn ${!filterYear?"active":""}`} onClick={()=>setFilterYear(null)}>Toutes</button>
          {years.map(y=><button key={y} className={`filter-btn ${filterYear===y?"active":""}`} onClick={()=>setFilterYear(y)}>{y}</button>)}
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nouvelle charge</button>
      </div>

      {/* Mini tableau de bord — uniquement les charges par immeuble */}
      <div className="stat-grid" style={{marginBottom:16}}>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Total des charges</span><div className="stat-icon-wrap" style={{background:"#fef2f2"}}>💸</div></div>
          <div className="stat-value" style={{fontSize:20}}>{fmt(total,currency)}</div>
          <div className="stat-delta">{filtered.length} charge(s){filterBuilding?"":" — tous immeubles"}{filterYear?` — ${filterYear}`:""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Par immeuble</span><div className="stat-icon-wrap" style={{background:"#eff6ff"}}>🏢</div></div>
          {byBuilding.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>
              {byBuilding.map(b=>(
                <div key={b.id} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                  <span style={{color:"var(--t3)"}}>{b.name}</span><span style={{fontWeight:600,color:"var(--t1)"}}>{fmt(b.total,currency)}</span>
                </div>
              ))}
            </div>
          ):<div style={{fontSize:13,color:"var(--t3)",marginTop:6}}>Aucune charge</div>}
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-label">Par annee</span><div className="stat-icon-wrap" style={{background:"#fffbeb"}}>📅</div></div>
          {byYearRows.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>
              {byYearRows.map(([y,v])=>(
                <div key={y} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                  <span style={{color:"var(--t3)"}}>{y}</span><span style={{fontWeight:600,color:"var(--t1)"}}>{fmt(v,currency)}</span>
                </div>
              ))}
            </div>
          ):<div style={{fontSize:13,color:"var(--t3)",marginTop:6}}>Aucune charge</div>}
        </div>
      </div>

      <div className="two-col" style={{marginBottom:16}}>
        <div className="card">
          <div className="card-header"><span className="card-title">Repartition par categorie</span></div>
          <div style={{padding:"18px 20px",display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <PieChart data={pieData} size={150}/>
            <div style={{flex:1,minWidth:160,display:"flex",flexDirection:"column",gap:8}}>
              {categoryRows.length>0?categoryRows.map(([label,value])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:CATEGORY_COLORS[label]||"#94a3b8",flexShrink:0}}/>
                  <span style={{flex:1,color:"var(--t2)"}}>{label}</span>
                  <span style={{fontWeight:700,color:"var(--t1)"}}>{total>0?Math.round((value/total)*100):0}%</span>
                  <span style={{color:"var(--t3)",minWidth:70,textAlign:"right"}}>{fmt(value,currency)}</span>
                </div>
              )):<div style={{fontSize:13,color:"var(--t3)"}}>Aucune charge</div>}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Par mois</span></div>
          <table>
            <thead><tr><th>Mois</th><th>Montant</th></tr></thead>
            <tbody>
              {monthRows.map(([m,v])=>(
                <tr key={m}>
                  <td className="td-primary" style={{textTransform:"capitalize"}}>{m==="inconnu"?"Date inconnue":monthName(m+"-01")}</td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--t1)"}}>{fmt(v,currency)}</td>
                </tr>
              ))}
              {monthRows.length===0&&<tr><td colSpan={2}><div className="empty"><div className="empty-icon">📅</div><div className="empty-text">Aucune charge enregistree</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Immeuble</th><th>Categorie</th><th>Montant</th><th>Date</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            {[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(c=>{
              const b=data.buildings.find(b=>b.id===c.buildingId);
              return (
                <tr key={c.id}>
                  <td className="td-primary">{b?.name||"-"}</td>
                  <td><span className="chip">{c.category}</span></td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--t1)"}}>{fmt(c.amount,currency)}</td>
                  <td className="td-mono">{fmtDate(c.date)}</td>
                  <td style={{fontSize:12,color:"var(--t3)"}}>{c.notes||"-"}</td>
                  <td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>openEdit(c)}>Editer</button><button className="btn btn-danger btn-sm" onClick={()=>del(c.id)}>X</button></div></td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={6}><div className="empty"><div className="empty-icon">💸</div><div className="empty-text">Aucune charge enregistree</div></div></td></tr>}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier la charge":"Nouvelle charge"}</div>
            <div className="modal-sub">Depense liee a un immeuble (electricite, eau, assurance, taxes...)</div>
            <div className="form-group"><label className="form-label">Immeuble</label>
              <select className="form-input" value={form.buildingId} onChange={e=>upd("buildingId",e.target.value)}>
                <option value="">-- Selectionner --</option>
                {data.buildings.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Categorie</label>
                <select className="form-input" value={form.category} onChange={e=>upd("category",e.target.value)}>
                  {CHARGE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e=>upd("date",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Montant ({currency})</label><input className="form-input" type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>upd("notes",e.target.value)}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Charges de copropriete (appels de fonds) ────────────────────────────────────
function SyndicCharges({ data, addRow, updateRow, deleteRow }) {
  const { currency } = useContext(CurrencyContext);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterBuilding, setFilterBuilding] = useState(null);
  const empty = {apartmentId:"",amount:"",period:"",dueDate:new Date().toISOString().split("T")[0],status:"a_payer",notes:""};
  const [form, setForm] = useState(empty);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const filteredApts = filterBuilding ? data.apartments.filter(a=>a.buildingId===filterBuilding) : data.apartments;
  const filteredCharges = data.syndicCharges.filter(c=>filteredApts.some(a=>a.id===c.apartmentId));

  const save = () => {
    const parsed = {...form,apartmentId:+form.apartmentId,amount:toStorage(form.amount,currency)};
    if(editing) updateRow("syndicCharges",{...parsed,id:editing});
    else addRow("syndicCharges",{...parsed,id:newId()});
    setShowModal(false);
  };
  const del = (id) => {if(window.confirm("Supprimer cet appel de fonds ?"))deleteRow("syndicCharges",id);};
  const openNew = () => {setEditing(null);setForm(empty);setShowModal(true);};
  const openEdit = (c) => {setEditing(c.id);setForm({...c,amount:toDisplay(c.amount,currency)});setShowModal(true);};

  const totalDu = filteredCharges.filter(c=>c.status!=="paye").reduce((s,c)=>s+c.amount,0);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><div style={{fontSize:11,fontWeight:600,color:"var(--t3)",textTransform:"uppercase"}}>Reste a payer</div><div style={{fontSize:22,fontWeight:700,color:"var(--amber)"}}>{fmt(totalDu,currency)}</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nouvel appel de fonds</button>
      </div>

      <div className="filter-bar">
        <span className="filter-label">Immeuble :</span>
        <button className={`filter-btn ${!filterBuilding?"active":""}`} onClick={()=>setFilterBuilding(null)}>Tous</button>
        {data.buildings.map(b=><button key={b.id} className={`filter-btn ${filterBuilding===b.id?"active":""}`} onClick={()=>setFilterBuilding(b.id)}>{b.name}</button>)}
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Appartement</th><th>Immeuble</th><th>Periode</th><th>Echeance</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredCharges.map(c=>{
              const a=data.apartments.find(a=>a.id===c.apartmentId);
              const b=a?data.buildings.find(b=>b.id===a.buildingId):null;
              return (
                <tr key={c.id}>
                  <td className="td-primary">{a?.name||"-"}</td>
                  <td style={{fontSize:12,color:"var(--t3)"}}>{b?.name||"-"}</td>
                  <td>{c.period||"-"}</td>
                  <td className="td-mono">{fmtDate(c.dueDate)}</td>
                  <td className="td-mono" style={{fontWeight:700,color:"var(--t1)"}}>{fmt(c.amount,currency)}</td>
                  <td><Badge status={c.status}/></td>
                  <td><div style={{display:"flex",gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>openEdit(c)}>Editer</button><button className="btn btn-danger btn-sm" onClick={()=>del(c.id)}>X</button></div></td>
                </tr>
              );
            })}
            {filteredCharges.length===0&&<tr><td colSpan={7}><div className="empty"><div className="empty-icon">🏛️</div><div className="empty-text">Aucun appel de fonds enregistre</div></div></td></tr>}
          </tbody>
        </table>
      </div>

      {showModal&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editing?"Modifier l'appel de fonds":"Nouvel appel de fonds"}</div>
            <div className="modal-sub">Charges de copropriete (syndic) par appartement</div>
            <div className="form-group"><label className="form-label">Appartement</label>
              <select className="form-input" value={form.apartmentId} onChange={e=>upd("apartmentId",e.target.value)}>
                <option value="">-- Selectionner --</option>
                {data.apartments.map(a=>{const b=data.buildings.find(b=>b.id===a.buildingId);return <option key={a.id} value={a.id}>{a.name} — {b?.name}</option>;})}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Periode (ex: T2 2026)</label><input className="form-input" value={form.period} onChange={e=>upd("period",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Echeance</label><input className="form-input" type="date" value={form.dueDate} onChange={e=>upd("dueDate",e.target.value)}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Montant ({currency})</label><input className="form-input" type="number" value={form.amount} onChange={e=>upd("amount",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input" value={form.status} onChange={e=>upd("status",e.target.value)}>
                  <option value="a_payer">A payer</option><option value="en_cours">En cours</option><option value="paye">Paye</option><option value="en_retard">En retard</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>upd("notes",e.target.value)}/></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export Excel ─────────────────────────────────────────────────────────────
function ExportPage({ data }) {
  const { currency } = useContext(CurrencyContext);

  const buildingName = (id) => data.buildings.find(b=>b.id===id)?.name || "-";
  const apartmentName = (id) => data.apartments.find(a=>a.id===id)?.name || "-";
  const apartmentBuildingName = (apartmentId) => { const a=data.apartments.find(a=>a.id===apartmentId); return a?buildingName(a.buildingId):"-"; };
  const tenantName = (id) => data.tenants.find(t=>t.id===id)?.name || "-";
  const num = (v) => Math.round(toDisplay(v,currency)*100)/100;

  const exportExcel = () => {
    const rows = [];
    const section = (title, headers, dataRows) => {
      rows.push([title]);
      rows.push(headers);
      dataRows.forEach(r=>rows.push(r));
      rows.push([]); // ligne vide de separation
    };

    section("IMMEUBLES", ["Nom","Adresse","Ville","Code postal","Etages","Type","Description"],
      data.buildings.map(b=>[b.name,b.address,b.city,b.zip,b.floors,b.type,b.description]));

    section("APPARTEMENTS", ["Nom","Immeuble","Surface (m2)","Pieces",`Loyer HC (${currency})`,`Charges (${currency})`,"Statut","Type","Etage","Description"],
      data.apartments.map(a=>[a.name,buildingName(a.buildingId),a.surface,a.rooms,num(a.rent),num(a.charges),a.status,a.type,a.floor,a.description]));

    section("LOCATAIRES", ["Nom","Email","Telephone","Appartement","Immeuble","Debut bail","Fin bail",`Depot de garantie (${currency})`,"Frequence de paiement","Notes"],
      data.tenants.map(t=>[t.name,t.email,t.phone,apartmentName(t.apartmentId),apartmentBuildingName(t.apartmentId),t.leaseStart,t.leaseEnd,num(t.deposit),FREQUENCY_LABELS[t.paymentFrequency]||"Mensuel",t.notes]));

    section("PAIEMENTS", ["Locataire","Appartement","Immeuble",`Montant (${currency})`,"Date","Type","Statut","Methode","Reference"],
      data.payments.map(p=>[tenantName(p.tenantId),apartmentName(p.apartmentId),apartmentBuildingName(p.apartmentId),num(p.amount),p.date,p.type,p.status,p.method,p.reference]));

    section("MAINTENANCE", ["Appartement","Immeuble","Description","Date","Statut","Priorite",`Cout (${currency})`,"Prestataire","Notes"],
      data.maintenances.map(m=>[apartmentName(m.apartmentId),apartmentBuildingName(m.apartmentId),m.description,m.date,m.status,m.priority,num(m.cost),m.provider,m.notes]));

    section("CHARGES PAR IMMEUBLE", ["Immeuble","Categorie",`Montant (${currency})`,"Date","Notes"],
      data.charges.map(c=>[buildingName(c.buildingId),c.category,num(c.amount),c.date,c.notes]));

    section("CHARGES COPRO", ["Appartement","Immeuble",`Montant (${currency})`,"Periode","Echeance","Statut","Notes"],
      data.syndicCharges.map(c=>[apartmentName(c.apartmentId),apartmentBuildingName(c.apartmentId),num(c.amount),c.period,c.dueDate,c.status,c.notes]));

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{wch:22},{wch:22},{wch:18},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:24}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ImmoGest");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `immogest-export-${dateStr}.xlsx`);
  };

  const counts = [
    ["Immeubles", data.buildings.length],
    ["Appartements", data.apartments.length],
    ["Locataires", data.tenants.length],
    ["Paiements", data.payments.length],
    ["Interventions maintenance", data.maintenances.length],
    ["Charges par immeuble", data.charges.length],
    ["Charges copro", data.syndicCharges.length],
  ];

  return (
    <div>
      <div className="card" style={{padding:28,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:8}}>📊</div>
        <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>Exporter toutes les donnees</div>
        <div style={{fontSize:13,color:"var(--t3)",marginBottom:20}}>Genere un fichier Excel (.xlsx) avec un seul tableau reprenant toutes les sections (immeubles, appartements, locataires, paiements, maintenance, charges copro), les unes en dessous des autres. Montants exprimes en {currency}.</div>
        <button className="btn btn-primary" onClick={exportExcel} style={{padding:"10px 24px",fontSize:14}}>⬇️ Telecharger le fichier Excel</button>
      </div>

      <div className="card" style={{marginTop:16}}>
        <div className="card-header"><span className="card-title">Contenu de l'export</span></div>
        <table>
          <thead><tr><th>Categorie</th><th>Nombre de lignes</th></tr></thead>
          <tbody>
            {counts.map(([label,count])=>(
              <tr key={label}><td className="td-primary">{label}</td><td className="td-mono">{count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────
function Settings({ data, saveOwner, resetAll }) {
  const [form, setForm] = useState({...data.owner});
  const [saved, setSaved] = useState(false);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => {saveOwner({...form});setSaved(true);setTimeout(()=>setSaved(false),2500);};
  return (
    <div style={{maxWidth:580}}>
      <div style={{fontSize:13,color:"var(--t2)",marginBottom:20}}>Ces informations apparaissent sur les <strong>quittances de loyer</strong>.</div>
      <div className="card" style={{padding:24}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--t1)",marginBottom:16}}>Informations du proprietaire</div>
        <div className="form-group"><label className="form-label">Nom complet</label><input className="form-input" value={form.name} onChange={e=>upd("name",e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={form.address} onChange={e=>upd("address",e.target.value)}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Ville</label><input className="form-input" value={form.city} onChange={e=>upd("city",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Code postal</label><input className="form-input" value={form.zip} onChange={e=>upd("zip",e.target.value)}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e=>upd("email",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Telephone</label><input className="form-input" value={form.phone} onChange={e=>upd("phone",e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">SIRET (optionnel)</label><input className="form-input" value={form.siret} onChange={e=>upd("siret",e.target.value)}/></div>
        <button className="btn btn-primary" onClick={save} style={{marginTop:8}}>{saved?"Sauvegarde !":"Sauvegarder"}</button>
      </div>
      <div className="card" style={{padding:24,marginTop:16,borderColor:"#fecaca"}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--red)",marginBottom:8}}>Zone dangereuse</div>
        <div style={{fontSize:13,color:"var(--t3)",marginBottom:14}}>Reinitialise toutes les donnees pour tout le monde (base partagee). Action irreversible.</div>
        <button className="btn btn-danger" onClick={()=>{if(window.confirm("Reinitialiser les donnees pour tous les utilisateurs ?"))resetAll();}}>Reinitialiser toutes les donnees</button>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard",label:"Tableau de bord",icon:"📊"},
  {id:"buildings",label:"Immeubles",icon:"🏢"},
  {id:"apartments",label:"Appartements",icon:"🏠"},
  {id:"tenants",label:"Locataires",icon:"👥"},
  {id:"payments",label:"Paiements",icon:"💶"},
  {id:"charges",label:"Charges",icon:"💸"},
  {id:"syndic",label:"Charges copro",icon:"🏛️"},
  {id:"maintenance",label:"Maintenance",icon:"🔧"},
  {id:"export",label:"Export Excel",icon:"📊"},
  {id:"settings",label:"Parametres",icon:"⚙️"},
];
const TITLES = {
  dashboard:["Tableau de bord","Vue d'ensemble"],
  buildings:["Immeubles","Gestion du parc immobilier"],
  apartments:["Appartements","Portefeuille par immeuble"],
  tenants:["Locataires","Gestion des baux"],
  payments:["Paiements","Loyers et encaissements"],
  charges:["Charges","Depenses par immeuble (electricite, eau, assurance...)"],
  syndic:["Charges copro","Appels de fonds par appartement"],
  maintenance:["Maintenance","Travaux et interventions"],
  export:["Export Excel","Telecharger toutes les donnees"],
  settings:["Parametres","Configuration du compte"],
};

// Detecte si une nouvelle version du site a ete deployee pendant que l'onglet est ouvert,
// pour eviter qu'un onglet ancien (code perime) reste utilise sans que personne s'en rende compte.
function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    let initialVersion = null;
    const check = () => {
      fetch("/version.txt", { cache: "no-store" })
        .then(r => r.text())
        .then(v => {
          v = v.trim();
          if (initialVersion === null) { initialVersion = v; return; }
          if (v && v !== initialVersion) setUpdateAvailable(true);
        })
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000); // toutes les 5 minutes
    return () => clearInterval(interval);
  }, []);
  return updateAvailable;
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const { data, addRow, updateRow, deleteRow, saveOwner, loading, resetAll } = useSupabaseData();
  const [currency, setCurrency] = useState(() => localStorage.getItem("immogest_currency") || "FCFA");
  useEffect(() => { localStorage.setItem("immogest_currency", currency); }, [currency]);
  const updateAvailable = useVersionCheck();

  const lateCount = data.payments.filter(p=>p.status==="en retard").length;
  const today = new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const [title,sub] = TITLES[page];

  const changePage = (id) => { setPage(id); if(id!=="apartments") setSelectedBuilding(null); };

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",flexDirection:"column",gap:12}}>
          <div style={{fontSize:32}}>🏢</div>
          <div style={{color:"var(--t3)",fontSize:13}}>Chargement des donnees...</div>
        </div>
      </>
    );
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      <style>{css}</style>
      {updateAvailable && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#111",color:"#fff",padding:"10px 20px",display:"flex",justifyContent:"center",alignItems:"center",gap:14,fontSize:13}}>
          <span>🔄 Une nouvelle version d'ImmoGest est disponible. Recharge la page pour avoir les dernieres corrections.</span>
          <button onClick={()=>window.location.reload()} style={{background:"#fff",color:"#111",border:"none",padding:"6px 14px",borderRadius:6,fontWeight:600,cursor:"pointer",fontSize:12}}>Recharger maintenant</button>
        </div>
      )}
      <div className="app" style={updateAvailable?{marginTop:42}:undefined}>
        <nav className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-row">
              <div className="brand-icon">🏢</div>
              <div><div className="brand-name">ImmoGest</div><div className="brand-version">Gestion locative pro</div></div>
            </div>
          </div>
          <div className="nav-group">
            <div className="nav-group-label">Navigation</div>
            {NAV.map(n=>(
              <div key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>changePage(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
                {n.id==="payments"&&lateCount>0&&<span className="nav-badge">{lateCount}</span>}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="sidebar-stats">
              <div className="sidebar-stat"><div className="sidebar-stat-val">{data.buildings.length}</div><div className="sidebar-stat-label">Immeubles</div></div>
              <div className="sidebar-stat"><div className="sidebar-stat-val">{data.apartments.length}</div><div className="sidebar-stat-label">Apts</div></div>
            </div>
          </div>
        </nav>
        <div className="main">
          <div className="topbar">
            <span className="topbar-title">{title}</span>
            <span className="topbar-sep">—</span>
            <span className="topbar-sub">{sub}</span>
            <div className="topbar-right">
              <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
                <button onClick={()=>setCurrency("FCFA")} style={{padding:"5px 12px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:currency==="FCFA"?"var(--accent)":"var(--white)",color:currency==="FCFA"?"#fff":"var(--t2)"}}>FCFA</button>
                <button onClick={()=>setCurrency("EUR")} style={{padding:"5px 12px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:currency==="EUR"?"var(--accent)":"var(--white)",color:currency==="EUR"?"#fff":"var(--t2)"}}>EUR</button>
              </div>
              <div className="topbar-date">{today}</div>
            </div>
          </div>
          <div className="content">
            {page==="dashboard"&&<Dashboard data={data}/>}
            {page==="buildings"&&<Buildings data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} setPage={setPage} setSelectedBuilding={setSelectedBuilding}/>}
            {page==="apartments"&&<Apartments data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow} selectedBuilding={selectedBuilding} setSelectedBuilding={setSelectedBuilding}/>}
            {page==="tenants"&&<Tenants data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow}/>}
            {page==="payments"&&<Payments data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow}/>}
            {page==="charges"&&<ChargesPage data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow}/>}
            {page==="syndic"&&<SyndicCharges data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow}/>}
            {page==="maintenance"&&<Maintenance data={data} addRow={addRow} updateRow={updateRow} deleteRow={deleteRow}/>}
            {page==="export"&&<ExportPage data={data}/>}
            {page==="settings"&&<Settings data={data} saveOwner={saveOwner} resetAll={resetAll}/>}
          </div>
        </div>
      </div>
    </CurrencyContext.Provider>
  );
}
