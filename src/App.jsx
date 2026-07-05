import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { load, save, loadPrefixed } from "./storage";

// ---------- data ----------
const FOODS = {
  protein: [
    { n: "Egg", u: "egg", k: 78, e: "🥚" },
    { n: "Chicken", u: "100g", k: 165, e: "🍗" },
    {
      n: "Yogurt", u: "cup", k: 150, e: "🥛",
      v: [
        { n: "1.5%", k: 100 },
        { n: "3%", k: 150 },
      ],
    },
    { n: "Tuna", u: "can", k: 120, e: "🐟" },
    {
      n: "Cottage", u: "100g", k: 90, e: "🥣",
      v: [
        { n: "3%", k: 90 },
        { n: "5%", k: 115 },
      ],
    },
    { n: "Beef", u: "100g", k: 250, e: "🥩" },
    { n: "Fish", u: "100g", k: 180, e: "🍣" },
    { n: "Tofu", u: "100g", k: 76, e: "🌱" },
    {
      n: "Cheese", u: "slice", k: 80, e: "🧀",
      v: [
        { n: "9%", k: 55 },
        { n: "28%", k: 80 },
      ],
    },
    {
      n: "Milk", u: "cup", k: 150, e: "🥛",
      v: [
        { n: "1%", k: 105 },
        { n: "3%", k: 150 },
      ],
    },
    { n: "Shake", u: "scoop", k: 120, e: "🥤" },
  ],
  carb: [
    { n: "Bread", u: "slice", k: 80, e: "🍞" },
    { n: "Pasta", u: "100g", k: 160, e: "🍝" },
    { n: "Rice", u: "cup", k: 200, e: "🍚" },
    { n: "Potato", u: "med", k: 160, e: "🥔" },
    { n: "Pita", u: "pita", k: 270, e: "🫓" },
    { n: "Oats", u: "bowl", k: 300, e: "🥣" },
    { n: "Cereal", u: "bowl", k: 250, e: "🥛" },
    { n: "Couscous", u: "cup", k: 175, e: "🍲" },
    { n: "Bureka", u: "bureka", k: 250, e: "🥐" },
    { n: "Rice cake", u: "cake", k: 35, e: "🍘" },
  ],
  veg: [
    { n: "Salad", u: "bowl", k: 50, e: "🥗" },
    { n: "Cucumber", u: "cucumber", k: 15, e: "🥒" },
    { n: "Tomato", u: "tomato", k: 25, e: "🍅" },
    { n: "Carrot", u: "carrot", k: 30, e: "🥕" },
    { n: "Pepper", u: "pepper", k: 30, e: "🫑" },
    { n: "Broccoli", u: "cup", k: 55, e: "🥦" },
    { n: "Corn", u: "cob", k: 90, e: "🌽" },
    { n: "Sweet potato", u: "med", k: 110, e: "🍠" },
    { n: "Avocado", u: "half", k: 160, e: "🥑" },
    { n: "Banana", u: "banana", k: 105, e: "🍌" },
    { n: "Fruit", u: "piece", k: 80, e: "🍎" },
  ],
  other: [
    { n: "Oil", u: "tbsp", k: 120, e: "🫒" },
    { n: "Nuts", u: "handful", k: 170, e: "🥜" },
    { n: "Chocolate", u: "row", k: 110, e: "🍫" },
    { n: "Hummus", u: "2 tbsp", k: 70, e: "🧆" },
    { n: "Pizza", u: "slice", k: 285, e: "🍕" },
    { n: "Snack bar", u: "bar", k: 200, e: "🍬" },
    { n: "Beer", u: "bottle", k: 150, e: "🍺" },
    { n: "Wine", u: "glass", k: 125, e: "🍷" },
    { n: "Ice cream", u: "scoop", k: 140, e: "🍨" },
    { n: "Cookie", u: "cookie", k: 80, e: "🍪" },
  ],
};

const CAT_META = {
  protein: { label: "PROTEIN", color: "#4FE3E0" },
  carb: { label: "CARB", color: "#FFB454" },
  veg: { label: "VEG", color: "#7DE07D" },
  other: { label: "OTHER", color: "#FF6FB5" },
  custom: { label: "CUSTOM", color: "#B48CFF" },
};

const DEFAULT_BUDGET = 14000;

// Sunday-start week key, e.g. "2026-06-28"
function weekKey(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x.toISOString().slice(0, 10);
}
function dayKey(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

// ---------- component ----------
export default function QuickCal({ onSignOut }) {
  const wk = weekKey();
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [entries, setEntries] = useState([]); // {t, kcal, label}
  const [loaded, setLoaded] = useState(false);

  const [openCat, setOpenCat] = useState(null); // 'protein' | 'carb' | 'other'
  const [pickedFood, setPickedFood] = useState(null);
  const [qty, setQty] = useState(1);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [budgetVal, setBudgetVal] = useState("");
  const [toast, setToast] = useState(null); // last added entry index
  const [confirmDel, setConfirmDel] = useState(null); // entry to delete
  const [confirmDelFood, setConfirmDelFood] = useState(null); // custom food to delete
  const [customFoods, setCustomFoods] = useState([]);
  const [variantIdx, setVariantIdx] = useState(0);
  const [variantPrefs, setVariantPrefs] = useState({});
  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKcal, setNewKcal] = useState("");
  const [pastWeeksOpen, setPastWeeksOpen] = useState(false);
  const [pastWeeks, setPastWeeks] = useState(null); // null = not fetched yet
  const [scanOpen, setScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [editFoodTarget, setEditFoodTarget] = useState(null); // original custom food being edited
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editKcal, setEditKcal] = useState("");
  const [editStep, setEditStep] = useState("0.5"); // stepper increment per tap
  const toastTimer = useRef(null);
  const videoRef = useRef(null);
  const scanControlsRef = useRef(null);

  useEffect(() => {
    (async () => {
      const b = await load("budget", DEFAULT_BUDGET);
      const e = await load("week:" + wk, []);
      const cf = await load("customFoods", []);
      const vp = await load("variantPrefs", {});
      setBudget(b);
      setEntries(e);
      setCustomFoods(cf);
      setVariantPrefs(vp);
      setLoaded(true);
    })();
  }, [wk]);

  useEffect(() => {
    if (!openCat) {
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
      setScanOpen(false);
      setScanStatus("");
    }
  }, [openCat]);

  const used = entries.reduce((s, e) => s + e.kcal, 0);
  const remaining = budget - used;
  const today = dayKey();
  const todayUsed = entries.filter((e) => e.d === today).reduce((s, e) => s + e.kcal, 0);
  const pct = Math.min(1, used / Math.max(1, budget));

  async function addEntry(kcal, label) {
    const e = [...entries, { t: Date.now(), d: dayKey(), kcal: Math.round(kcal), label }];
    setEntries(e);
    await save("week:" + wk, e);
    setOpenCat(null);
    setPickedFood(null);
    setQty(1);
    setCustomOpen(false);
    setCustomVal("");
    setToast({ kcal: Math.round(kcal), label });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function undo() {
    const e = entries.slice(0, -1);
    setEntries(e);
    await save("week:" + wk, e);
    setToast(null);
  }

  async function removeEntry(t) {
    const e = entries.filter((x) => x.t !== t);
    setEntries(e);
    await save("week:" + wk, e);
    setConfirmDel(null);
  }

  async function removeCustomFood(name) {
    const cf = customFoods.filter((f) => f.n !== name);
    setCustomFoods(cf);
    await save("customFoods", cf);
    setConfirmDelFood(null);
    setPickedFood(null);
  }

  function openEditFood(f) {
    setEditFoodTarget(f);
    setEditName(f.n);
    setEditUnit(f.u);
    setEditKcal(String(f.k));
    setEditStep(String(f.s || 0.5));
  }

  async function saveEditFood() {
    const k = parseInt(editKcal, 10);
    const s = parseFloat(editStep);
    if (!editName.trim() || !(k > 0) || !editUnit.trim() || !(s > 0)) return;
    const updated = {
      n: editName.trim(),
      u: editUnit.trim(),
      k,
      s,
      e: editFoodTarget.e || "✦",
    };
    const cf = customFoods.map((f) => (f === editFoodTarget ? updated : f));
    setCustomFoods(cf);
    await save("customFoods", cf);
    setEditFoodTarget(null);
  }

  async function saveBudget() {
    const v = parseInt(budgetVal, 10);
    if (v > 0) {
      setBudget(v);
      await save("budget", v);
    }
    setBudgetEdit(false);
  }

  async function togglePastWeeks() {
    const opening = !pastWeeksOpen;
    setPastWeeksOpen(opening);
    if (opening && pastWeeks === null) {
      const rows = await loadPrefixed("week:");
      const weeks = rows
        .filter((r) => r.key !== "week:" + wk)
        .map((r) => ({
          key: r.key,
          start: r.key.slice(5),
          total: (r.value || []).reduce((s, e) => s + e.kcal, 0),
        }))
        .sort((a, b) => (a.start < b.start ? 1 : -1));
      setPastWeeks(weeks);
    }
  }

  async function saveNewFood() {
    const k = parseInt(newKcal, 10);
    if (!newName.trim() || !(k > 0)) return;
    const cf = [...customFoods, { n: newName.trim(), u: "portion", k, e: "✦" }];
    setCustomFoods(cf);
    await save("customFoods", cf);
    setAddFoodOpen(false);
    setNewName("");
    setNewKcal("");
  }

  function stopScan() {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    setScanOpen(false);
    setScanStatus("");
  }

  function startScan() {
    setScanStatus("Point camera at barcode…");
    setScanOpen(true);
  }

  useEffect(() => {
    if (!scanOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          (result) => {
            if (result) lookupBarcode(result.getText());
          }
        );
        if (cancelled) controls.stop();
        else scanControlsRef.current = controls;
      } catch (e) {
        console.error("scan start failed:", e);
        if (!cancelled) setScanStatus("Camera unavailable — check permissions.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanOpen]);

  async function lookupBarcode(code) {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    setScanStatus(`Looking up ${code}…`);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        setScanStatus("Product not found. Try again or add manually.");
        return;
      }
      const p = data.product;
      const kcal = Math.round(
        p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.["energy-kcal_serving"] ?? 0
      );
      setScanOpen(false);
      setScanStatus("");
      setNewName(p.product_name?.trim() || `Barcode ${code}`);
      setNewKcal(kcal > 0 ? String(kcal) : "");
      setAddFoodOpen(true);
    } catch (e) {
      console.error("lookup failed:", e);
      setScanStatus("Lookup failed. Try again.");
    }
  }

  // ring positions
  const ringSource = openCat
    ? openCat === "custom"
      ? [...customFoods, { addBtn: true }, { scanBtn: true }]
      : FOODS[openCat]
    : [];
  const ringItems = ringSource.map((f, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
    return { f, x: Math.cos(a) * 132, y: Math.sin(a) * 132 };
  });

  const S = styles;

  return (
    <div style={S.app}>
      <style>{css}</style>

      {/* header */}
      <div style={S.header}>
        <div style={S.todayLabel}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase()}
        </div>
        <div style={S.headerRow}>
          <span style={S.eyebrow}>WEEK BUDGET</span>
          {budgetEdit ? (
            <span style={{ display: "flex", gap: 6 }}>
              <input
                autoFocus
                inputMode="numeric"
                value={budgetVal}
                onChange={(ev) => setBudgetVal(ev.target.value.replace(/\D/g, ""))}
                style={S.budgetInput}
              />
              <button style={S.miniBtn} onClick={saveBudget}>OK</button>
            </span>
          ) : (
            <button
              style={S.budgetBtn}
              onClick={() => {
                setBudgetVal(String(budget));
                setBudgetEdit(true);
              }}
            >
              {budget.toLocaleString()} kcal ✎
            </button>
          )}
        </div>

        <div style={S.remaining} className={remaining < 0 ? "neg" : ""}>
          {loaded ? remaining.toLocaleString() : "—"}
        </div>
        <div style={S.remLabel}>{remaining < 0 ? "OVER BUDGET" : "REMAINING"}</div>

        <div style={S.barTrack}>
          <div
            style={{
              ...S.barFill,
              width: `${pct * 100}%`,
              background: pct < 0.8 ? "#4FE3E0" : pct < 1 ? "#FFB454" : "#FF5A5A",
            }}
          />
        </div>
        <div style={S.subStats}>
          <span>used {used.toLocaleString()}</span>
          <span>today {todayUsed.toLocaleString()}</span>
        </div>
      </div>

      {/* main dial */}
      <div style={S.dialWrap}>
        <button style={S.centerBtn} onClick={() => setCustomOpen(true)} aria-label="Add calories">
          <span style={S.centerPlus}>+</span>
          <span style={S.centerLabel}>KCAL</span>
        </button>

        {["protein", "carb", "veg", "other", "custom"].map((c, i) => {
          const a = (-90 + i * 72) * (Math.PI / 180);
          const x = Math.cos(a) * 118;
          const y = Math.sin(a) * 118;
          const m = CAT_META[c];
          return (
            <button
              key={c}
              onClick={() => setOpenCat(c)}
              style={{
                ...S.catBtn,
                borderColor: m.color,
                color: m.color,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* completed weeks */}
      {loaded && (
        <div style={S.logWrap}>
          <button style={S.pastWeeksBtn} onClick={togglePastWeeks}>
            {pastWeeksOpen ? "HIDE COMPLETED WEEKS" : "SHOW COMPLETED WEEKS"}
          </button>
          {pastWeeksOpen &&
            (pastWeeks === null ? (
              <div style={S.dayHeader}>Loading…</div>
            ) : pastWeeks.length === 0 ? (
              <div style={S.logKcal}>No completed weeks yet.</div>
            ) : (
              pastWeeks.map((w) => {
                const start = new Date(w.start + "T12:00");
                const end = new Date(start);
                end.setDate(end.getDate() + 6);
                const fmt = (dt) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <div key={w.key} style={S.dayHeader}>
                    <span>{fmt(start)} – {fmt(end)}</span>
                    <span>{w.total.toLocaleString()} kcal</span>
                  </div>
                );
              })
            ))}
        </div>
      )}

      {/* week log */}
      {loaded && entries.length > 0 && (
        <div style={S.logWrap}>
          <div style={S.logTitle}>THIS WEEK</div>
          {Object.entries(
            entries.reduce((g, e) => {
              (g[e.d] = g[e.d] || []).push(e);
              return g;
            }, {})
          )
            .sort((a, b) => (a[0] < b[0] ? 1 : -1))
            .map(([d, list]) => (
              <div key={d} style={S.dayGroup}>
                <div style={S.dayHeader}>
                  <span>
                    {d === today
                      ? "Today"
                      : new Date(d + "T12:00").toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                        })}
                  </span>
                  <span style={{ color: list.reduce((s, e) => s + e.kcal, 0) > budget / 7 ? "#FF5A5A" : "#7DE07D" }}>
                    {list.reduce((s, e) => s + e.kcal, 0).toLocaleString()}
                  </span>
                </div>
                {[...list].reverse().map((e) => (
                  <div key={e.t} style={S.logRow}>
                    <span style={S.logTime}>
                      {new Date(e.t).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span style={S.logLabel}>{e.label}</span>
                    <span style={S.logKcal}>{e.kcal}</span>
                    <button style={S.delBtn} onClick={() => setConfirmDel(e)} aria-label="Remove entry">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* delete confirmation */}
      {confirmDel && (
        <div style={S.overlay} onClick={() => setConfirmDel(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>
              Remove entry?
              <span style={S.sheetSub}>
                {confirmDel.label} · {confirmDel.kcal} kcal ·{" "}
                {new Date(confirmDel.t).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                style={{ ...S.addBtn, background: "#1A2233", color: "#8FA3BC" }}
                onClick={() => setConfirmDel(null)}
              >
                CANCEL
              </button>
              <button
                style={{ ...S.addBtn, background: "#FF5A5A", color: "#200606" }}
                onClick={() => removeEntry(confirmDel.t)}
              >
                REMOVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast / undo */}
      {toast && (
        <div style={S.toast}>
          <span>
            +{toast.kcal} · {toast.label}
          </span>
          <button style={S.undoBtn} onClick={undo}>
            UNDO
          </button>
        </div>
      )}

      {/* food ring overlay */}
      {openCat && !pickedFood && (
        <div style={S.overlay} onClick={() => setOpenCat(null)}>
          <div style={S.ringWrap} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.ringCenter, color: CAT_META[openCat].color }}>
              {CAT_META[openCat].label}
              <span style={S.ringHint}>tap to add</span>
            </div>
            {ringItems.map(({ f, x, y }) =>
              f.addBtn ? (
                <button
                  key="__add"
                  style={{
                    ...S.foodBtn,
                    borderColor: CAT_META.custom.color,
                    borderStyle: "dashed",
                    color: CAT_META.custom.color,
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                  onClick={() => setAddFoodOpen(true)}
                >
                  <span style={{ fontSize: 22 }}>+</span>
                  <span style={S.foodName}>ADD</span>
                </button>
              ) : f.scanBtn ? (
                <button
                  key="__scan"
                  style={{
                    ...S.foodBtn,
                    borderColor: CAT_META.custom.color,
                    borderStyle: "dashed",
                    color: CAT_META.custom.color,
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                  onClick={startScan}
                >
                  <span style={{ fontSize: 20 }}>📷</span>
                  <span style={S.foodName}>SCAN</span>
                </button>
              ) : openCat === "custom" ? (
                <div
                  key={f.n}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  <button
                    style={{
                      ...S.foodBtn,
                      position: "relative",
                      left: 0,
                      top: 0,
                      transform: "none",
                      borderColor: CAT_META.custom.color + "55",
                    }}
                    onClick={() => {
                      setPickedFood(f);
                      setQty(1);
                      if (f.v) {
                        const i = f.v.findIndex((x) => x.n === variantPrefs[f.n]);
                        setVariantIdx(i >= 0 ? i : 0);
                      }
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{f.e}</span>
                    <span style={S.foodName}>{f.n}</span>
                  </button>
                  <button
                    style={S.foodEditBadge}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditFood(f);
                    }}
                    aria-label={`Edit ${f.n}`}
                  >
                    ✎
                  </button>
                  <button
                    style={S.foodDelBadge}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelFood(f);
                    }}
                    aria-label={`Remove ${f.n}`}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  key={f.n}
                  style={{
                    ...S.foodBtn,
                    borderColor: CAT_META[openCat].color + "55",
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                  onClick={() => {
                    setPickedFood(f);
                    setQty(1);
                    if (f.v) {
                      const i = f.v.findIndex((x) => x.n === variantPrefs[f.n]);
                      setVariantIdx(i >= 0 ? i : 0);
                    }
                  }}
                >
                  <span style={{ fontSize: 22 }}>{f.e}</span>
                  <span style={S.foodName}>{f.n}</span>
                </button>
              )
            )}
            <button style={S.closeX} onClick={() => setOpenCat(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* barcode scanner */}
      {scanOpen && (
        <div style={S.overlay} onClick={stopScan}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Scan barcode</div>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", borderRadius: 12, marginTop: 10, background: "#000" }}
            />
            <div style={{ ...S.sheetSub, marginTop: 10 }}>{scanStatus}</div>
            <button
              style={{ ...S.addBtn, background: "#1A2233", color: "#8FA3BC", marginTop: 16 }}
              onClick={stopScan}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* delete custom food confirmation */}
      {confirmDelFood && (
        <div style={S.overlay} onClick={() => setConfirmDelFood(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>
              Remove {confirmDelFood.n}?
              <span style={S.sheetSub}>It will no longer appear in CUSTOM.</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                style={{ ...S.addBtn, background: "#1A2233", color: "#8FA3BC" }}
                onClick={() => setConfirmDelFood(null)}
              >
                CANCEL
              </button>
              <button
                style={{ ...S.addBtn, background: "#FF5A5A", color: "#200606" }}
                onClick={() => removeCustomFood(confirmDelFood.n)}
              >
                REMOVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* amount popup */}
      {pickedFood && (() => {
        const variant = pickedFood.v ? pickedFood.v[variantIdx] : null;
        const unitK = variant ? variant.k : pickedFood.k;
        const step = pickedFood.s || 0.5;
        const label = variant
          ? `${pickedFood.n} ${variant.n} ×${qty}`
          : `${pickedFood.n} ×${qty}`;
        return (
          <div style={S.overlay} onClick={() => setPickedFood(null)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <div style={S.sheetTitle}>
                {pickedFood.e} {pickedFood.n}
                <span style={S.sheetSub}>
                  {unitK} kcal / {pickedFood.u}
                </span>
              </div>
              {pickedFood.v && (
                <div style={S.pillRow}>
                  {pickedFood.v.map((v, i) => (
                    <button
                      key={v.n}
                      style={{
                        ...S.pill,
                        ...(i === variantIdx ? S.pillActive : {}),
                      }}
                      onClick={() => setVariantIdx(i)}
                    >
                      {v.n}
                    </button>
                  ))}
                </div>
              )}
              <div style={S.stepper}>
                <button style={S.stepBtn} onClick={() => setQty(Math.max(step, qty - step))}>
                  −
                </button>
                <div style={S.qty}>
                  {qty}
                  <span style={S.qtyUnit}>× {pickedFood.u}</span>
                </div>
                <button style={S.stepBtn} onClick={() => setQty(qty + step)}>
                  +
                </button>
              </div>
              <button
                style={S.addBtn}
                onClick={async () => {
                  if (variant && variantPrefs[pickedFood.n] !== variant.n) {
                    const vp = { ...variantPrefs, [pickedFood.n]: variant.n };
                    setVariantPrefs(vp);
                    save("variantPrefs", vp);
                  }
                  addEntry(unitK * qty, label);
                }}
              >
                ADD {Math.round(unitK * qty)} KCAL
              </button>
            </div>
          </div>
        );
      })()}

      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{ marginTop: 36, background: "none", border: "none", color: "#2A3548", fontFamily: mono, fontSize: 10, letterSpacing: 2, cursor: "pointer" }}
        >
          SIGN OUT
        </button>
      )}

      {/* new custom food popup */}
      {addFoodOpen && (
        <div style={S.overlay} onClick={() => setAddFoodOpen(false)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>New food</div>
            <input
              autoFocus
              placeholder="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ ...S.bigInput, fontSize: 18, marginBottom: 0 }}
            />
            <input
              inputMode="numeric"
              placeholder="kcal / portion"
              value={newKcal}
              onChange={(e) => setNewKcal(e.target.value.replace(/\D/g, ""))}
              style={{ ...S.bigInput, fontSize: 18, marginTop: 10 }}
            />
            <button
              style={{ ...S.addBtn, background: "#B48CFF", opacity: newName.trim() && newKcal ? 1 : 0.4 }}
              disabled={!newName.trim() || !newKcal}
              onClick={saveNewFood}
            >
              SAVE
            </button>
          </div>
        </div>
      )}

      {/* edit custom food popup */}
      {editFoodTarget && (
        <div style={S.overlay} onClick={() => setEditFoodTarget(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Edit food</div>
            <input
              autoFocus
              placeholder="name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{ ...S.bigInput, fontSize: 18, marginBottom: 0 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                inputMode="numeric"
                placeholder="kcal"
                value={editKcal}
                onChange={(e) => setEditKcal(e.target.value.replace(/\D/g, ""))}
                style={{ ...S.bigInput, fontSize: 18, marginTop: 0, flex: 1 }}
              />
              <input
                placeholder="portion (e.g. 100g)"
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                style={{ ...S.bigInput, fontSize: 18, marginTop: 0, flex: 1 }}
              />
            </div>

            <div style={S.divisionsLabel}>DIVISIONS (stepper increment per tap)</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                inputMode="decimal"
                placeholder="0.5"
                value={editStep}
                onChange={(e) => setEditStep(e.target.value.replace(/[^0-9.]/g, ""))}
                style={{ ...S.bigInput, fontSize: 18, marginTop: 0, flex: 1 }}
              />
              <div style={S.chips}>
                {[0.25, 0.5, 1].map((v) => (
                  <button key={v} style={S.chip} onClick={() => setEditStep(String(v))}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                style={{ ...S.addBtn, background: "#1A2233", color: "#8FA3BC" }}
                onClick={() => setEditFoodTarget(null)}
              >
                CANCEL
              </button>
              <button
                style={{
                  ...S.addBtn,
                  background: "#4FE3E0",
                  opacity: editName.trim() && editKcal && editUnit.trim() && editStep ? 1 : 0.4,
                }}
                disabled={!editName.trim() || !editKcal || !editUnit.trim() || !editStep}
                onClick={saveEditFood}
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* custom kcal popup */}
      {customOpen && (
        <div style={S.overlay} onClick={() => setCustomOpen(false)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>Add calories</div>
            <input
              autoFocus
              inputMode="numeric"
              placeholder="kcal"
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value.replace(/\D/g, ""))}
              style={S.bigInput}
            />
            <div style={S.chips}>
              {[100, 200, 300, 500].map((v) => (
                <button key={v} style={S.chip} onClick={() => setCustomVal(String(v))}>
                  {v}
                </button>
              ))}
            </div>
            <button
              style={{ ...S.addBtn, opacity: customVal ? 1 : 0.4 }}
              disabled={!customVal}
              onClick={() => addEntry(parseInt(customVal, 10), "custom")}
            >
              ADD {customVal || 0} KCAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- styles ----------
const mono = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0B0E14",
    color: "#D7E0EA",
    fontFamily: mono,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px 48px",
    userSelect: "none",
  },
  header: { width: "100%", maxWidth: 360, textAlign: "center" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: "#5A6B80" },
  todayLabel: { fontSize: 11, letterSpacing: 3, color: "#5A6B80", marginBottom: 8 },
  budgetBtn: {
    background: "none",
    border: "none",
    color: "#5A6B80",
    fontFamily: mono,
    fontSize: 12,
    cursor: "pointer",
  },
  budgetInput: {
    width: 80,
    background: "#131826",
    border: "1px solid #2A3548",
    color: "#D7E0EA",
    fontFamily: mono,
    fontSize: 13,
    padding: "2px 6px",
    borderRadius: 6,
  },
  miniBtn: {
    background: "#4FE3E0",
    border: "none",
    borderRadius: 6,
    fontFamily: mono,
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 10px",
    cursor: "pointer",
  },
  remaining: { fontSize: 56, fontWeight: 700, letterSpacing: -1, marginTop: 10, lineHeight: 1 },
  remLabel: { fontSize: 11, letterSpacing: 3, color: "#5A6B80", marginTop: 6 },
  barTrack: {
    height: 6,
    background: "#1A2233",
    borderRadius: 3,
    marginTop: 14,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3, transition: "width .4s" },
  subStats: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#5A6B80",
    marginTop: 6,
  },
  dialWrap: { position: "relative", width: 320, height: 320, marginTop: 48 },
  logWrap: { width: "100%", maxWidth: 360, marginTop: 40 },
  logTitle: { fontSize: 11, letterSpacing: 3, color: "#5A6B80", marginBottom: 12 },
  pastWeeksBtn: {
    width: "100%",
    background: "none",
    border: "1px dashed #2A3548",
    borderRadius: 8,
    color: "#5A6B80",
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 2,
    padding: "10px 0",
    marginBottom: 12,
    cursor: "pointer",
  },
  dayGroup: { marginBottom: 18 },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#8FA3BC",
    letterSpacing: 1,
    borderBottom: "1px solid #1A2233",
    paddingBottom: 5,
    marginBottom: 4,
  },
  logRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 0",
    fontSize: 13,
  },
  logLabel: { flex: 1, color: "#D7E0EA" },
  logTime: {
    color: "#3D4A61",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },
  logKcal: { color: "#5A6B80", fontVariantNumeric: "tabular-nums" },
  delBtn: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "none",
    border: "1px solid #2A3548",
    color: "#5A6B80",
    fontFamily: mono,
    fontSize: 11,
    cursor: "pointer",
    flexShrink: 0,
  },
  centerBtn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%,-50%)",
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "#131826",
    border: "2px solid #D7E0EA",
    color: "#D7E0EA",
    fontFamily: mono,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 32px rgba(79,227,224,.12)",
  },
  centerPlus: { fontSize: 40, lineHeight: 1 },
  centerLabel: { fontSize: 11, letterSpacing: 3, marginTop: 2 },
  catBtn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 84,
    height: 84,
    borderRadius: "50%",
    background: "#0F1420",
    border: "2px solid",
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(6,8,12,.88)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  ringWrap: { position: "relative", width: 340, height: 340 },
  ringCenter: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%,-50%)",
    textAlign: "center",
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  ringHint: { fontSize: 10, letterSpacing: 1, color: "#5A6B80", fontWeight: 400 },
  foodBtn: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 66,
    height: 66,
    borderRadius: "50%",
    background: "#131826",
    border: "1.5px solid",
    color: "#D7E0EA",
    fontFamily: mono,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  foodName: { fontSize: 9, letterSpacing: 0.5 },
  closeX: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1A2233",
    border: "1px solid #2A3548",
    color: "#5A6B80",
    fontFamily: mono,
    cursor: "pointer",
  },
  sheet: {
    width: 300,
    background: "#131826",
    border: "1px solid #2A3548",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sheetSub: { fontSize: 11, color: "#5A6B80", fontWeight: 400 },
  foodDelBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#1A2233",
    border: "1px solid #2A3548",
    color: "#FF6FB5",
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  divisionsLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: "#5A6B80",
    marginTop: 16,
    textAlign: "left",
  },
  foodEditBadge: {
    position: "absolute",
    left: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#1A2233",
    border: "1px solid #2A3548",
    color: "#4FE3E0",
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    margin: "22px 0",
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#0F1420",
    border: "1.5px solid #2A3548",
    color: "#D7E0EA",
    fontSize: 24,
    fontFamily: mono,
    cursor: "pointer",
  },
  qty: { fontSize: 30, fontWeight: 700, minWidth: 90 },
  qtyUnit: { display: "block", fontSize: 10, color: "#5A6B80", fontWeight: 400, marginTop: 2 },
  addBtn: {
    width: "100%",
    padding: "14px 0",
    borderRadius: 12,
    background: "#4FE3E0",
    border: "none",
    color: "#062020",
    fontFamily: mono,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1.5,
    cursor: "pointer",
  },
  bigInput: {
    width: "100%",
    boxSizing: "border-box",
    margin: "18px 0 12px",
    padding: "12px",
    fontSize: 28,
    textAlign: "center",
    background: "#0F1420",
    border: "1.5px solid #2A3548",
    borderRadius: 12,
    color: "#D7E0EA",
    fontFamily: mono,
  },
  chips: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 },
  pillRow: { display: "flex", gap: 6, justifyContent: "center", marginTop: 16 },
  pill: {
    padding: "7px 12px",
    borderRadius: 999,
    background: "#0F1420",
    border: "1.5px solid #2A3548",
    color: "#8FA3BC",
    fontFamily: mono,
    fontSize: 12,
    cursor: "pointer",
  },
  pillActive: {
    borderColor: "#4FE3E0",
    color: "#4FE3E0",
    fontWeight: 700,
  },
  chip: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "#0F1420",
    border: "1px solid #2A3548",
    color: "#8FA3BC",
    fontFamily: mono,
    fontSize: 12,
    cursor: "pointer",
  },
  toast: {
    position: "fixed",
    bottom: 22,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#131826",
    border: "1px solid #2A3548",
    borderRadius: 999,
    padding: "10px 16px",
    display: "flex",
    gap: 14,
    alignItems: "center",
    fontSize: 13,
    zIndex: 20,
  },
  undoBtn: {
    background: "none",
    border: "none",
    color: "#4FE3E0",
    fontFamily: mono,
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1,
    cursor: "pointer",
  },
};

const css = `
  .neg { color: #FF5A5A; }
  button:active { transform-origin: center; filter: brightness(1.25); }
`;
