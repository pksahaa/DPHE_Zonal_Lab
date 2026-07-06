import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Droplet, FlaskConical, Beaker, Wrench, ClipboardList, BarChart3, Plus, Upload, Download, AlertTriangle, CheckCircle2, X, Trash2 } from "lucide-react";

// ---------------- Palette ----------------
const C = {
  ink: "#123437",
  teal: "#028090",
  tealDark: "#045C64",
  seafoam: "#00A896",
  mint: "#02C39A",
  bg: "#F3FAF9",
  card: "#FFFFFF",
  warn: "#C7511F",
  warnBg: "#FDEDE6",
  ok: "#0E7C56",
  okBg: "#E6F6EF",
  border: "#D6ECEA",
  muted: "#5B7275",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const fmtNum = (n) => (Math.round((n + Number.EPSILON) * 1000) / 1000).toString();

// ---------------- Seed data ----------------
function seedChemicals() {
  return [
    {
      id: uid("chem"), name: "Fe Standard", unit: "ml",
      batches: [
        { id: uid("batch"), dateReceived: "2026-01-10", expiryDate: "2026-07-15", initialAmount: 500, remaining: 120, status: "active" },
        { id: uid("batch"), dateReceived: "2026-05-02", expiryDate: "2027-01-02", initialAmount: 500, remaining: 500, status: "active" },
      ],
    },
    {
      id: uid("chem"), name: "HCl", unit: "ml",
      batches: [
        { id: uid("batch"), dateReceived: "2025-11-01", expiryDate: "2026-06-20", initialAmount: 1000, remaining: 300, status: "active" },
        { id: uid("batch"), dateReceived: "2026-03-15", expiryDate: "2026-12-31", initialAmount: 1000, remaining: 1000, status: "active" },
      ],
    },
  ];
}
function seedGlassware() {
  return [
    { id: uid("glass"), name: "Volumetric Flask 100ml", dateReceived: "2025-09-01", dateBroken: null, status: "in_use" },
    { id: uid("glass"), name: "Burette 50ml", dateReceived: "2025-09-01", dateBroken: null, status: "in_use" },
  ];
}
function seedEquipment() {
  return [
    {
      id: uid("equip"), name: "UV-Vis Spectrophotometer", dateReceived: "2024-06-01", functional: true,
      history: [
        { id: uid("evt"), date: "2026-03-10", type: "breakdown", description: "Lamp not igniting", cost: 0, functionalAfter: false },
        { id: uid("evt"), date: "2026-03-18", type: "repair", description: "Replaced UV lamp", cost: 4500, functionalAfter: true },
      ],
    },
    { id: uid("equip"), name: "Digital pH Meter", dateReceived: "2025-01-15", functional: true, history: [] },
  ];
}
function seedTestTypes() {
  return [
    {
      id: uid("test"), name: "Iron Test (Fe)",
      requirements: [
        {
          chemical: "Fe Standard",
          items: [
            { id: uid("item"), label: "Fe Mother Solution", type: "direct" },
            { id: uid("item"), label: "Wastage", type: "direct" },
          ],
        },
        {
          chemical: "HCl",
          items: [
            { id: uid("item"), label: "Sampling", type: "countAmount", countLabel: "No. of Samples", amountLabel: "HCl required per sample (ml)" },
            { id: uid("item"), label: "Standard Preparation", type: "countAmount", countLabel: "No. of Standards", amountLabel: "HCl required (ml)" },
            { id: uid("item"), label: "Sample Preparation", type: "countAmount", countLabel: "No. of Samples", amountLabel: "HCl required (ml)" },
            { id: uid("item"), label: "Wastage", type: "direct" },
          ],
        },
      ],
    },
  ];
}

// ---------------- Persistence helpers ----------------
async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    if (res && res.value) return JSON.parse(res.value);
    return fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    // ignore write errors in demo
  }
}

// ---------------- Small UI primitives ----------------
function Badge({ children, tone = "ok" }) {
  const tones = {
    ok: { color: C.ok, background: C.okBg },
    warn: { color: C.warn, background: C.warnBg },
    muted: { color: C.muted, background: "#EEF4F3" },
  };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ color: tones[tone].color, background: tones[tone].background }}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, icon, right, children }) {
  return (
    <div className="rounded-lg mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm" style={{ color: C.ink }}>{title}</h3>
        </div>
        <div>{right}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TextField({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: C.muted }}>
      {label}
      <input
        {...props}
        className="border rounded px-2 py-1.5 text-sm"
        style={{ borderColor: C.border, color: C.ink, ...(props.style || {}) }}
      />
    </label>
  );
}

function Button({ children, onClick, variant = "primary", type = "button", size = "md", disabled }) {
  const base = "inline-flex items-center gap-1.5 rounded font-medium transition-colors disabled:opacity-40";
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  const styles =
    variant === "primary"
      ? { background: C.teal, color: "#fff" }
      : variant === "outline"
      ? { background: "transparent", color: C.teal, border: `1px solid ${C.teal}` }
      : { background: "transparent", color: C.warn, border: `1px solid ${C.warn}` };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes}`} style={styles}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: "rgba(10,30,32,0.45)" }}>
      <div className="rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="font-semibold text-sm" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose}><X size={18} color={C.muted} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------- Inventory logic ----------------
function markExpiredBatches(chemicals) {
  const today = todayStr();
  return chemicals.map((c) => ({
    ...c,
    batches: c.batches.map((b) => {
      if (b.status === "depleted") return b;
      if (b.expiryDate < today && b.status !== "expired") return { ...b, status: "expired" };
      if (b.expiryDate >= today && b.status === "expired") return { ...b, status: "active" };
      return b;
    }),
  }));
}

function fefoSuggestion(chemical) {
  if (!chemical) return null;
  const active = chemical.batches.filter((b) => b.status === "active" && b.remaining > 0);
  active.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  return active[0] || null;
}

// deduct `amount` of a chemical, starting at preferredBatchId (or FEFO order), rolling over as needed
function deductFromChemical(chemical, amount, preferredBatchId) {
  let batches = chemical.batches.map((b) => ({ ...b }));
  const order = [...batches].filter((b) => b.status === "active" && b.remaining > 0)
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  if (preferredBatchId) {
    const idx = order.findIndex((b) => b.id === preferredBatchId);
    if (idx > 0) {
      const [chosen] = order.splice(idx, 1);
      order.unshift(chosen);
    }
  }
  let left = amount;
  const usedFrom = [];
  for (const b of order) {
    if (left <= 0) break;
    const take = Math.min(b.remaining, left);
    if (take <= 0) continue;
    const target = batches.find((x) => x.id === b.id);
    target.remaining = +(target.remaining - take).toFixed(4);
    if (target.remaining <= 0) {
      target.remaining = 0;
      target.status = "depleted";
    }
    left = +(left - take).toFixed(4);
    usedFrom.push({ batchId: b.id, amount: take });
  }
  return { batches, shortfall: +left.toFixed(4), usedFrom };
}

// ---------------- Excel import helpers ----------------
function readWorkbook(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      cb(null, rows);
    } catch (err) {
      cb(err);
    }
  };
  reader.onerror = () => cb(new Error("Could not read file"));
  reader.readAsBinaryString(file);
}

// ============================================================================
export default function LabApp() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("inventory");
  const [invTab, setInvTab] = useState("chemicals");
  const [reportTab, setReportTab] = useState("consumption");

  const [chemicals, setChemicals] = useState([]);
  const [glassware, setGlassware] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [testTypes, setTestTypes] = useState([]);
  const [testRecords, setTestRecords] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, g, e, t, r] = await Promise.all([
        loadKey("chemicals", seedChemicals()),
        loadKey("glassware", seedGlassware()),
        loadKey("equipment", seedEquipment()),
        loadKey("testTypes", seedTestTypes()),
        loadKey("testRecords", []),
      ]);
      setChemicals(markExpiredBatches(c));
      setGlassware(g);
      setEquipment(e);
      setTestTypes(t);
      setTestRecords(r);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveKey("chemicals", chemicals); }, [chemicals, loaded]);
  useEffect(() => { if (loaded) saveKey("glassware", glassware); }, [glassware, loaded]);
  useEffect(() => { if (loaded) saveKey("equipment", equipment); }, [equipment, loaded]);
  useEffect(() => { if (loaded) saveKey("testTypes", testTypes); }, [testTypes, loaded]);
  useEffect(() => { if (loaded) saveKey("testRecords", testRecords); }, [testRecords, loaded]);

  const notify = useCallback((msg, tone = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3200);
  }, []);

  if (!loaded) {
    return <div className="p-8 text-sm" style={{ color: C.muted }}>Loading lab data…</div>;
  }

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.tealDark }}>
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center gap-3">
          <div className="rounded-full p-2" style={{ background: "rgba(255,255,255,0.15)" }}>
            <Droplet size={20} color="#fff" />
          </div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">Zonal Water Quality Lab</div>
            <div className="text-xs" style={{ color: "#BFE3E0" }}>Inventory &amp; Test Record Management — Demo</div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 flex gap-1">
          {[
            { k: "inventory", label: "Inventory", icon: <FlaskConical size={15} /> },
            { k: "addTest", label: "Add Test Record", icon: <ClipboardList size={15} /> },
            { k: "reports", label: "Reports", icon: <BarChart3 size={15} /> },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t"
              style={{
                color: tab === t.k ? C.tealDark : "#DDF2F0",
                background: tab === t.k ? C.bg : "transparent",
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6">
        {tab === "inventory" && (
          <InventoryTab
            invTab={invTab} setInvTab={setInvTab}
            chemicals={chemicals} setChemicals={setChemicals}
            glassware={glassware} setGlassware={setGlassware}
            equipment={equipment} setEquipment={setEquipment}
            notify={notify}
          />
        )}
        {tab === "addTest" && (
          <AddTestTab
            testTypes={testTypes} setTestTypes={setTestTypes}
            chemicals={chemicals} setChemicals={setChemicals}
            testRecords={testRecords} setTestRecords={setTestRecords}
            notify={notify}
          />
        )}
        {tab === "reports" && (
          <ReportsTab
            reportTab={reportTab} setReportTab={setReportTab}
            chemicals={chemicals} equipment={equipment} testRecords={testRecords}
          />
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-5 right-5 px-4 py-2.5 rounded shadow-lg text-sm font-medium flex items-center gap-2 z-50"
          style={{
            background: toast.tone === "warn" ? C.warnBg : C.okBg,
            color: toast.tone === "warn" ? C.warn : C.ok,
            border: `1px solid ${toast.tone === "warn" ? C.warn : C.ok}`,
          }}
        >
          {toast.tone === "warn" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INVENTORY TAB
// ============================================================================
function InventoryTab({ invTab, setInvTab, chemicals, setChemicals, glassware, setGlassware, equipment, setEquipment, notify }) {
  const [showAddChemical, setShowAddChemical] = useState(false);
  const [batchFormFor, setBatchFormFor] = useState(null);
  const [showAddGlass, setShowAddGlass] = useState(false);
  const [breakFormFor, setBreakFormFor] = useState(null);
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [eventFormFor, setEventFormFor] = useState(null);

  function importChemicals(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      setChemicals((prev) => {
        const next = [...prev];
        rows.forEach((row) => {
          const name = String(row.ChemicalName || row.Chemical || "").trim();
          if (!name) return;
          const unit = String(row.Unit || "ml").trim();
          let chem = next.find((c) => c.name.toLowerCase() === name.toLowerCase());
          if (!chem) {
            chem = { id: uid("chem"), name, unit, batches: [] };
            next.push(chem);
          }
          chem.batches.push({
            id: uid("batch"),
            dateReceived: String(row.DateReceived || todayStr()),
            expiryDate: String(row.ExpiryDate || todayStr()),
            initialAmount: Number(row.Amount || 0),
            remaining: Number(row.Amount || 0),
            status: "active",
          });
        });
        return markExpiredBatches(next);
      });
      notify(`Imported ${rows.length} chemical batch row(s) from Excel`);
    });
  }
  function importGlassware(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      setGlassware((prev) => [
        ...prev,
        ...rows.map((row) => ({
          id: uid("glass"),
          name: String(row.Name || row.Item || "Item"),
          dateReceived: String(row.DateReceived || todayStr()),
          dateBroken: row.DateBroken ? String(row.DateBroken) : null,
          status: row.DateBroken ? "broken" : "in_use",
        })),
      ]);
      notify(`Imported ${rows.length} glassware row(s) from Excel`);
    });
  }
  function importEquipment(file) {
    readWorkbook(file, (err, rows) => {
      if (err) return notify("Could not read Excel file", "warn");
      setEquipment((prev) => [
        ...prev,
        ...rows.map((row) => ({
          id: uid("equip"),
          name: String(row.Name || row.Equipment || "Equipment"),
          dateReceived: String(row.DateReceived || todayStr()),
          functional: true,
          history: [],
        })),
      ]);
      notify(`Imported ${rows.length} equipment row(s) from Excel`);
    });
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {[
          { k: "chemicals", label: "Chemicals", icon: <FlaskConical size={14} /> },
          { k: "glassware", label: "Glassware", icon: <Beaker size={14} /> },
          { k: "equipment", label: "Equipment", icon: <Wrench size={14} /> },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setInvTab(t.k)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: invTab === t.k ? C.teal : "#fff",
              color: invTab === t.k ? "#fff" : C.muted,
              border: `1px solid ${invTab === t.k ? C.teal : C.border}`,
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {invTab === "chemicals" && (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && importChemicals(e.target.files[0])} />
              <span><Button variant="outline" size="sm"><Upload size={14} />Import from Excel</Button></span>
            </label>
            <Button size="sm" onClick={() => setShowAddChemical(true)}><Plus size={14} />Add Chemical</Button>
          </div>
          {chemicals.map((chem) => (
            <SectionCard
              key={chem.id}
              title={`${chem.name}  ·  unit: ${chem.unit}`}
              icon={<FlaskConical size={16} color={C.teal} />}
              right={<Button size="sm" variant="outline" onClick={() => setBatchFormFor(chem.id)}><Plus size={13} />Add Batch</Button>}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: C.muted }} className="text-left">
                    <th className="pb-1.5">Date Received</th>
                    <th className="pb-1.5">Expiry Date</th>
                    <th className="pb-1.5">Initial Amount</th>
                    <th className="pb-1.5">Remaining</th>
                    <th className="pb-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chem.batches.length === 0 && (
                    <tr><td colSpan={5} className="py-2" style={{ color: C.muted }}>No batches yet.</td></tr>
                  )}
                  {[...chem.batches].sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1)).map((b) => (
                    <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td className="py-1.5">{b.dateReceived}</td>
                      <td className="py-1.5">{b.expiryDate}</td>
                      <td className="py-1.5">{fmtNum(b.initialAmount)} {chem.unit}</td>
                      <td className="py-1.5 font-medium">{fmtNum(b.remaining)} {chem.unit}</td>
                      <td className="py-1.5">
                        {b.status === "active" && <Badge tone="ok">Active</Badge>}
                        {b.status === "expired" && <Badge tone="warn">Expired</Badge>}
                        {b.status === "depleted" && <Badge tone="muted">Depleted</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          ))}

          {showAddChemical && (
            <Modal title="Add Chemical" onClose={() => setShowAddChemical(false)}>
              <AddChemicalForm
                onSave={(name, unit) => {
                  setChemicals((prev) => [...prev, { id: uid("chem"), name, unit, batches: [] }]);
                  setShowAddChemical(false);
                  notify(`Added chemical "${name}"`);
                }}
                onCancel={() => setShowAddChemical(false)}
              />
            </Modal>
          )}
          {batchFormFor && (
            <Modal title="Add Batch" onClose={() => setBatchFormFor(null)}>
              <AddBatchForm
                onSave={(batch) => {
                  setChemicals((prev) =>
                    markExpiredBatches(
                      prev.map((c) => (c.id === batchFormFor ? { ...c, batches: [...c.batches, { id: uid("batch"), ...batch, remaining: batch.initialAmount, status: "active" }] } : c))
                    )
                  );
                  setBatchFormFor(null);
                  notify("Batch added to inventory");
                }}
                onCancel={() => setBatchFormFor(null)}
              />
            </Modal>
          )}
        </div>
      )}

      {invTab === "glassware" && (
        <SectionCard
          title="Glassware Register"
          icon={<Beaker size={16} color={C.teal} />}
          right={
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && importGlassware(e.target.files[0])} />
                <span><Button variant="outline" size="sm"><Upload size={13} />Import</Button></span>
              </label>
              <Button size="sm" onClick={() => setShowAddGlass(true)}><Plus size={13} />Add Glassware</Button>
            </div>
          }
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }} className="text-left">
                <th className="pb-1.5">Name</th>
                <th className="pb-1.5">Date Received</th>
                <th className="pb-1.5">Date Broken</th>
                <th className="pb-1.5">Status</th>
                <th className="pb-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {glassware.map((g) => (
                <tr key={g.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-1.5">{g.name}</td>
                  <td className="py-1.5">{g.dateReceived}</td>
                  <td className="py-1.5">{g.dateBroken || "—"}</td>
                  <td className="py-1.5">{g.status === "in_use" ? <Badge tone="ok">In Use</Badge> : <Badge tone="warn">Broken</Badge>}</td>
                  <td className="py-1.5">
                    {g.status === "in_use" && (
                      <button className="text-xs underline" style={{ color: C.warn }} onClick={() => setBreakFormFor(g.id)}>Mark Broken</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {showAddGlass && (
            <Modal title="Add Glassware" onClose={() => setShowAddGlass(false)}>
              <AddGlasswareForm
                onSave={(name, dateReceived) => {
                  setGlassware((prev) => [...prev, { id: uid("glass"), name, dateReceived, dateBroken: null, status: "in_use" }]);
                  setShowAddGlass(false);
                  notify(`Added glassware "${name}"`);
                }}
                onCancel={() => setShowAddGlass(false)}
              />
            </Modal>
          )}
          {breakFormFor && (
            <Modal title="Mark Glassware Broken" onClose={() => setBreakFormFor(null)}>
              <BreakGlassForm
                onSave={(dateBroken) => {
                  setGlassware((prev) => prev.map((g) => (g.id === breakFormFor ? { ...g, dateBroken, status: "broken" } : g)));
                  setBreakFormFor(null);
                  notify("Glassware marked broken");
                }}
                onCancel={() => setBreakFormFor(null)}
              />
            </Modal>
          )}
        </SectionCard>
      )}

      {invTab === "equipment" && (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && importEquipment(e.target.files[0])} />
              <span><Button variant="outline" size="sm"><Upload size={14} />Import from Excel</Button></span>
            </label>
            <Button size="sm" onClick={() => setShowAddEquip(true)}><Plus size={14} />Add Equipment</Button>
          </div>
          {equipment.map((eq) => (
            <SectionCard
              key={eq.id}
              title={eq.name}
              icon={<Wrench size={16} color={C.teal} />}
              right={
                <div className="flex items-center gap-2">
                  {eq.functional ? <Badge tone="ok">Functional</Badge> : <Badge tone="warn">Not Functional</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setEventFormFor(eq.id)}><Plus size={13} />Log Event</Button>
                </div>
              }
            >
              <div className="text-xs mb-2" style={{ color: C.muted }}>Received: {eq.dateReceived}</div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: C.muted }} className="text-left">
                    <th className="pb-1.5">Date</th>
                    <th className="pb-1.5">Event</th>
                    <th className="pb-1.5">Description</th>
                    <th className="pb-1.5">Cost</th>
                    <th className="pb-1.5">Functional After</th>
                  </tr>
                </thead>
                <tbody>
                  {eq.history.length === 0 && (
                    <tr><td colSpan={5} className="py-2" style={{ color: C.muted }}>No history logged yet.</td></tr>
                  )}
                  {[...eq.history].sort((a, b) => (a.date < b.date ? -1 : 1)).map((h) => (
                    <tr key={h.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td className="py-1.5">{h.date}</td>
                      <td className="py-1.5 capitalize">{h.type}</td>
                      <td className="py-1.5">{h.description}</td>
                      <td className="py-1.5">{h.cost ? `৳${fmtNum(h.cost)}` : "—"}</td>
                      <td className="py-1.5">{h.functionalAfter ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          ))}

          {showAddEquip && (
            <Modal title="Add Equipment" onClose={() => setShowAddEquip(false)}>
              <AddEquipmentForm
                onSave={(name, dateReceived) => {
                  setEquipment((prev) => [...prev, { id: uid("equip"), name, dateReceived, functional: true, history: [] }]);
                  setShowAddEquip(false);
                  notify(`Added equipment "${name}"`);
                }}
                onCancel={() => setShowAddEquip(false)}
              />
            </Modal>
          )}
          {eventFormFor && (
            <Modal title="Log Equipment Event" onClose={() => setEventFormFor(null)}>
              <EquipmentEventForm
                onSave={(evt) => {
                  setEquipment((prev) =>
                    prev.map((eq) =>
                      eq.id === eventFormFor
                        ? { ...eq, functional: evt.functionalAfter, history: [...eq.history, { id: uid("evt"), ...evt }] }
                        : eq
                    )
                  );
                  setEventFormFor(null);
                  notify("Event logged for equipment");
                }}
                onCancel={() => setEventFormFor(null)}
              />
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

function AddChemicalForm({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ml");
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Chemical Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sulfuric Acid" />
      <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml, g, L" />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => name.trim() && onSave(name.trim(), unit.trim() || "ml")}>Save</Button>
      </div>
    </div>
  );
}
function AddBatchForm({ onSave, onCancel }) {
  const [dateReceived, setDateReceived] = useState(todayStr());
  const [expiryDate, setExpiryDate] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Date of Receive" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
      <TextField label="Expiry Date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
      <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500" />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => expiryDate && amount && onSave({ dateReceived, expiryDate, initialAmount: Number(amount) })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
function AddGlasswareForm({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [dateReceived, setDateReceived] = useState(todayStr());
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conical Flask 250ml" />
      <TextField label="Date of Receive" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => name.trim() && onSave(name.trim(), dateReceived)}>Save</Button>
      </div>
    </div>
  );
}
function BreakGlassForm({ onSave, onCancel }) {
  const [dateBroken, setDateBroken] = useState(todayStr());
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Date Broken" type="date" value={dateBroken} onChange={(e) => setDateBroken(e.target.value)} />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(dateBroken)}>Save</Button>
      </div>
    </div>
  );
}
function AddEquipmentForm({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [dateReceived, setDateReceived] = useState(todayStr());
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Equipment Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turbidity Meter" />
      <TextField label="Date of Receive" type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => name.trim() && onSave(name.trim(), dateReceived)}>Save</Button>
      </div>
    </div>
  );
}
function EquipmentEventForm({ onSave, onCancel }) {
  const [type, setType] = useState("breakdown");
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [functionalAfter, setFunctionalAfter] = useState(type === "repair");
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs" style={{ color: C.muted }}>
        Event Type
        <select className="border rounded px-2 py-1.5 text-sm" style={{ borderColor: C.border }} value={type} onChange={(e) => { setType(e.target.value); setFunctionalAfter(e.target.value === "repair"); }}>
          <option value="breakdown">Breakdown / Fault</option>
          <option value="repair">Repair</option>
        </select>
      </label>
      <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What broke / what was fixed" />
      {type === "repair" && <TextField label="Repair Cost (৳)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="e.g. 2500" />}
      <label className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
        <input type="checkbox" checked={functionalAfter} onChange={(e) => setFunctionalAfter(e.target.checked)} />
        Equipment is functional after this event
      </label>
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => description.trim() && onSave({ type, date, description: description.trim(), cost: Number(cost) || 0, functionalAfter })}>Save</Button>
      </div>
    </div>
  );
}

// ============================================================================
// ADD TEST RECORD TAB
// ============================================================================
function AddTestTab({ testTypes, setTestTypes, chemicals, setChemicals, testRecords, setTestRecords, notify }) {
  const [selectedTestId, setSelectedTestId] = useState(testTypes[0]?.id || "");
  const [values, setValues] = useState({}); // itemId -> {count, amount} or {value}
  const [bottleOverride, setBottleOverride] = useState({}); // chemicalName -> batchId
  const [tester, setTester] = useState("");
  const [testDate, setTestDate] = useState(todayStr());
  const [showBuilder, setShowBuilder] = useState(false);

  const selectedTest = testTypes.find((t) => t.id === selectedTestId);

  function setDirect(itemId, val) {
    setValues((prev) => ({ ...prev, [itemId]: { value: Number(val) || 0 } }));
  }
  function setCountAmount(itemId, field, val) {
    setValues((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: Number(val) || 0 } }));
  }

  function totalsByChemical() {
    if (!selectedTest) return {};
    const totals = {};
    selectedTest.requirements.forEach((req) => {
      let sum = 0;
      req.items.forEach((item) => {
        const v = values[item.id] || {};
        if (item.type === "direct") sum += v.value || 0;
        else sum += (v.count || 0) * (v.amount || 0);
      });
      totals[req.chemical] = sum;
    });
    return totals;
  }
  const totals = totalsByChemical();

  function chemicalByName(name) {
    return chemicals.find((c) => c.name.toLowerCase() === name.toLowerCase());
  }

  function handleSave() {
    if (!selectedTest) return;
    if (!tester.trim()) return notify("Please enter tester name", "warn");

    let nextChemicals = markExpiredBatches(chemicals.map((c) => ({ ...c, batches: c.batches.map((b) => ({ ...b })) })));
    const consumption = {};
    const bottleLog = {};
    let anyShortfall = false;

    Object.entries(totals).forEach(([chemName, amount]) => {
      if (amount <= 0) return;
      const chem = nextChemicals.find((c) => c.name.toLowerCase() === chemName.toLowerCase());
      if (!chem) return;
      const preferred = bottleOverride[chemName];
      const { batches, shortfall, usedFrom } = deductFromChemical(chem, amount, preferred);
      chem.batches = batches;
      consumption[chemName] = amount;
      bottleLog[chemName] = usedFrom;
      if (shortfall > 0) anyShortfall = true;
    });

    setChemicals(nextChemicals);
    setTestRecords((prev) => [
      ...prev,
      { id: uid("rec"), date: testDate, tester: tester.trim(), testTypeName: selectedTest.name, consumption, bottleLog },
    ]);

    notify(
      anyShortfall
        ? `Test record saved — some chemicals had insufficient active stock, please restock soon.`
        : `Test record saved. Inventory updated (FEFO).`,
      anyShortfall ? "warn" : "ok"
    );
    setValues({});
    setBottleOverride({});
    setTester("");
  }

  return (
    <div>
      <div className="flex items-end gap-3 mb-5 flex-wrap">
        <label className="flex flex-col gap-1 text-xs" style={{ color: C.muted }}>
          Select Test Type
          <select
            className="border rounded px-2 py-1.5 text-sm min-w-[220px]"
            style={{ borderColor: C.border }}
            value={selectedTestId}
            onChange={(e) => { setSelectedTestId(e.target.value); setValues({}); setBottleOverride({}); }}
          >
            {testTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <TextField label="Tester Name" value={tester} onChange={(e) => setTester(e.target.value)} placeholder="e.g. M. Rahman" />
        <TextField label="Test Date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
        <Button variant="outline" onClick={() => setShowBuilder(true)}><Plus size={14} />New Test Type</Button>
      </div>

      {!selectedTest && <div className="text-sm" style={{ color: C.muted }}>No test types defined yet — create one to get started.</div>}

      {selectedTest && selectedTest.requirements.map((req) => (
        <SectionCard key={req.chemical} title={req.chemical} icon={<FlaskConical size={16} color={C.teal} />}>
          <div className="flex flex-col gap-3">
            {req.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 flex-wrap">
                <div className="text-xs font-medium w-48" style={{ color: C.ink }}>{item.label}</div>
                {item.type === "direct" ? (
                  <input
                    type="number" placeholder="ml"
                    className="border rounded px-2 py-1.5 text-sm w-28"
                    style={{ borderColor: C.border }}
                    value={values[item.id]?.value ?? ""}
                    onChange={(e) => setDirect(item.id, e.target.value)}
                  />
                ) : (
                  <>
                    <input
                      type="number" placeholder={item.countLabel}
                      className="border rounded px-2 py-1.5 text-sm w-32"
                      style={{ borderColor: C.border }}
                      value={values[item.id]?.count ?? ""}
                      onChange={(e) => setCountAmount(item.id, "count", e.target.value)}
                    />
                    <span className="text-xs" style={{ color: C.muted }}>×</span>
                    <input
                      type="number" placeholder={item.amountLabel}
                      className="border rounded px-2 py-1.5 text-sm w-36"
                      style={{ borderColor: C.border }}
                      value={values[item.id]?.amount ?? ""}
                      onChange={(e) => setCountAmount(item.id, "amount", e.target.value)}
                    />
                    <span className="text-xs" style={{ color: C.muted }}>
                      = {fmtNum((values[item.id]?.count || 0) * (values[item.id]?.amount || 0))} ml
                    </span>
                  </>
                )}
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="text-xs font-semibold" style={{ color: C.tealDark }}>
                Total {req.chemical} required: {fmtNum(totals[req.chemical] || 0)} ml
              </div>
              <BottleSelector
                chemical={chemicalByName(req.chemical)}
                needed={totals[req.chemical] || 0}
                value={bottleOverride[req.chemical]}
                onChange={(batchId) => setBottleOverride((prev) => ({ ...prev, [req.chemical]: batchId }))}
              />
            </div>
          </div>
        </SectionCard>
      ))}

      {selectedTest && (
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Test Record</Button>
        </div>
      )}

      {showBuilder && (
        <Modal title="Create New Test Type" onClose={() => setShowBuilder(false)}>
          <TestTypeBuilder
            onSave={(testType) => {
              setTestTypes((prev) => [...prev, testType]);
              setSelectedTestId(testType.id);
              setShowBuilder(false);
              notify(`Test type "${testType.name}" created`);
            }}
            onCancel={() => setShowBuilder(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function BottleSelector({ chemical, needed, value, onChange }) {
  if (!chemical) return <span className="text-xs" style={{ color: C.warn }}>Chemical not found in inventory</span>;
  const suggestion = fefoSuggestion(chemical);
  const activeBatches = chemical.batches.filter((b) => b.status === "active");
  return (
    <label className="flex items-center gap-2 text-xs ml-auto" style={{ color: C.muted }}>
      Bottle:
      <select
        className="border rounded px-2 py-1 text-xs"
        style={{ borderColor: C.border }}
        value={value || (suggestion ? suggestion.id : "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {activeBatches.length === 0 && <option value="">No active stock</option>}
        {activeBatches.map((b) => (
          <option key={b.id} value={b.id}>
            Exp {b.expiryDate} · {fmtNum(b.remaining)} left{suggestion && b.id === suggestion.id ? " (FEFO)" : ""}
          </option>
        ))}
      </select>
      {needed > (activeBatches.reduce((s, b) => s + b.remaining, 0)) && (
        <span style={{ color: C.warn }} className="flex items-center gap-1"><AlertTriangle size={12} />low stock</span>
      )}
    </label>
  );
}

function TestTypeBuilder({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [requirements, setRequirements] = useState([]);

  function addChemicalReq() {
    setRequirements((prev) => [...prev, { chemical: "", items: [] }]);
  }
  function updateChemName(idx, val) {
    setRequirements((prev) => prev.map((r, i) => (i === idx ? { ...r, chemical: val } : r)));
  }
  function addItem(idx, type) {
    setRequirements((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              items: [
                ...r.items,
                type === "direct"
                  ? { id: uid("item"), label: "New Item", type: "direct" }
                  : { id: uid("item"), label: "New Item", type: "countAmount", countLabel: "Count", amountLabel: "Amount required (ml)" },
              ],
            }
          : r
      )
    );
  }
  function updateItemLabel(reqIdx, itemId, val) {
    setRequirements((prev) =>
      prev.map((r, i) => (i === reqIdx ? { ...r, items: r.items.map((it) => (it.id === itemId ? { ...it, label: val } : it)) } : r))
    );
  }
  function removeItem(reqIdx, itemId) {
    setRequirements((prev) => prev.map((r, i) => (i === reqIdx ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r)));
  }
  function removeReq(idx) {
    setRequirements((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField label="Test Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chlorine Test" />

      {requirements.map((req, idx) => (
        <div key={idx} className="rounded p-3" style={{ border: `1px solid ${C.border}`, background: "#FAFEFE" }}>
          <div className="flex items-center gap-2 mb-2">
            <input
              className="border rounded px-2 py-1 text-sm flex-1"
              style={{ borderColor: C.border }}
              placeholder="Chemical name (e.g. HCl)"
              value={req.chemical}
              onChange={(e) => updateChemName(idx, e.target.value)}
            />
            <button onClick={() => removeReq(idx)}><Trash2 size={14} color={C.warn} /></button>
          </div>
          {req.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 mb-1.5">
              <input
                className="border rounded px-2 py-1 text-xs flex-1"
                style={{ borderColor: C.border }}
                value={item.label}
                onChange={(e) => updateItemLabel(idx, item.id, e.target.value)}
              />
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#EEF4F3", color: C.muted }}>
                {item.type === "direct" ? "direct ml" : "count × ml"}
              </span>
              <button onClick={() => removeItem(idx, item.id)}><X size={13} color={C.warn} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-1.5">
            <Button size="sm" variant="outline" onClick={() => addItem(idx, "direct")}>+ Direct input item</Button>
            <Button size="sm" variant="outline" onClick={() => addItem(idx, "countAmount")}>+ Count × amount item</Button>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addChemicalReq}><Plus size={13} />Add Chemical Requirement</Button>

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => {
            if (!name.trim() || requirements.length === 0) return;
            onSave({ id: uid("test"), name: name.trim(), requirements });
          }}
        >
          Save Test Type
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// REPORTS TAB
// ============================================================================
function ReportsTab({ reportTab, setReportTab, chemicals, equipment, testRecords }) {
  function exportRows(rows, filename) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename);
  }

  const consumption = {};
  testRecords.forEach((r) => {
    Object.entries(r.consumption).forEach(([chem, amt]) => {
      consumption[chem] = (consumption[chem] || 0) + amt;
    });
  });

  const stockRows = chemicals.flatMap((c) =>
    c.batches.map((b) => ({
      Chemical: c.name, DateReceived: b.dateReceived, ExpiryDate: b.expiryDate,
      InitialAmount: b.initialAmount, Remaining: b.remaining, Status: b.status,
    }))
  );

  const equipHistoryRows = equipment.flatMap((eq) =>
    eq.history.map((h) => ({
      Equipment: eq.name, Date: h.date, EventType: h.type, Description: h.description,
      Cost: h.cost, FunctionalAfter: h.functionalAfter ? "Yes" : "No",
    }))
  );
  const totalRepairCost = equipHistoryRows.reduce((s, r) => s + (r.EventType === "repair" ? r.Cost : 0), 0);

  const testLogRows = testRecords.map((r) => ({
    Date: r.date, Tester: r.tester, Test: r.testTypeName,
    ...Object.fromEntries(Object.entries(r.consumption).map(([k, v]) => [`${k} used (ml)`, fmtNum(v)])),
  }));

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { k: "consumption", label: "Chemical Consumption" },
          { k: "stock", label: "Stock & Expiry" },
          { k: "equipment", label: "Equipment History" },
          { k: "testlog", label: "Test Record Log" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setReportTab(t.k)}
            className="px-3.5 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: reportTab === t.k ? C.teal : "#fff",
              color: reportTab === t.k ? "#fff" : C.muted,
              border: `1px solid ${reportTab === t.k ? C.teal : C.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportTab === "consumption" && (
        <SectionCard
          title="Total Chemical Consumption (all test records)"
          icon={<BarChart3 size={16} color={C.teal} />}
          right={<Button size="sm" variant="outline" onClick={() => exportRows(Object.entries(consumption).map(([Chemical, Used_ml]) => ({ Chemical, Used_ml: fmtNum(Used_ml) })), "chemical_consumption.xlsx")}><Download size={13} />Export</Button>}
        >
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.muted }} className="text-left"><th className="pb-1.5">Chemical</th><th className="pb-1.5">Total Used</th></tr></thead>
            <tbody>
              {Object.keys(consumption).length === 0 && <tr><td colSpan={2} className="py-2" style={{ color: C.muted }}>No test records yet.</td></tr>}
              {Object.entries(consumption).map(([chem, amt]) => (
                <tr key={chem} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-1.5">{chem}</td><td className="py-1.5 font-medium">{fmtNum(amt)} ml</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {reportTab === "stock" && (
        <SectionCard
          title="Stock & Expiry Status (FEFO view)"
          icon={<FlaskConical size={16} color={C.teal} />}
          right={<Button size="sm" variant="outline" onClick={() => exportRows(stockRows, "stock_expiry.xlsx")}><Download size={13} />Export</Button>}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }} className="text-left">
                <th className="pb-1.5">Chemical</th><th className="pb-1.5">Received</th><th className="pb-1.5">Expiry</th>
                <th className="pb-1.5">Initial</th><th className="pb-1.5">Remaining</th><th className="pb-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-1.5">{r.Chemical}</td><td className="py-1.5">{r.DateReceived}</td><td className="py-1.5">{r.ExpiryDate}</td>
                  <td className="py-1.5">{fmtNum(r.InitialAmount)}</td><td className="py-1.5">{fmtNum(r.Remaining)}</td>
                  <td className="py-1.5">
                    {r.Status === "active" && <Badge tone="ok">Active</Badge>}
                    {r.Status === "expired" && <Badge tone="warn">Expired</Badge>}
                    {r.Status === "depleted" && <Badge tone="muted">Depleted</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {reportTab === "equipment" && (
        <SectionCard
          title={`Equipment History (total repair cost: ৳${fmtNum(totalRepairCost)})`}
          icon={<Wrench size={16} color={C.teal} />}
          right={<Button size="sm" variant="outline" onClick={() => exportRows(equipHistoryRows, "equipment_history.xlsx")}><Download size={13} />Export</Button>}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }} className="text-left">
                <th className="pb-1.5">Equipment</th><th className="pb-1.5">Date</th><th className="pb-1.5">Event</th>
                <th className="pb-1.5">Description</th><th className="pb-1.5">Cost</th><th className="pb-1.5">Functional After</th>
              </tr>
            </thead>
            <tbody>
              {equipHistoryRows.length === 0 && <tr><td colSpan={6} className="py-2" style={{ color: C.muted }}>No equipment events logged yet.</td></tr>}
              {equipHistoryRows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-1.5">{r.Equipment}</td><td className="py-1.5">{r.Date}</td><td className="py-1.5 capitalize">{r.EventType}</td>
                  <td className="py-1.5">{r.Description}</td><td className="py-1.5">{r.Cost ? `৳${fmtNum(r.Cost)}` : "—"}</td>
                  <td className="py-1.5">{r.FunctionalAfter === "Yes" ? <Badge tone="ok">Yes</Badge> : <Badge tone="warn">No</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {reportTab === "testlog" && (
        <SectionCard
          title="Test Record Log"
          icon={<ClipboardList size={16} color={C.teal} />}
          right={<Button size="sm" variant="outline" onClick={() => exportRows(testLogRows, "test_records.xlsx")}><Download size={13} />Export</Button>}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.muted }} className="text-left">
                <th className="pb-1.5">Date</th><th className="pb-1.5">Tester</th><th className="pb-1.5">Test</th><th className="pb-1.5">Chemicals Used</th>
              </tr>
            </thead>
            <tbody>
              {testRecords.length === 0 && <tr><td colSpan={4} className="py-2" style={{ color: C.muted }}>No test records yet.</td></tr>}
              {[...testRecords].reverse().map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td className="py-1.5">{r.date}</td><td className="py-1.5">{r.tester}</td><td className="py-1.5">{r.testTypeName}</td>
                  <td className="py-1.5">{Object.entries(r.consumption).map(([k, v]) => `${k}: ${fmtNum(v)}ml`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}
