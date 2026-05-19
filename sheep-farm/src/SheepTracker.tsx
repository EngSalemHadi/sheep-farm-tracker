import { useState, useMemo, useEffect, useRef } from "react";
import MonthlyChart from "./MonthlyChart";
import { exportToCSV } from "./exportData";
import { generatePDFReport } from "./generateReport";

const EXPENSE_CATEGORIES = ["علف", "حبوب", "دواء وعلاج", "نقل وشحن", "إيجار", "مصاريف تشغيلية", "مصاريف شخصية", "أخرى"];
const LOSS_REASONS = ["نفوق (وفاة)", "ضياع", "سرقة", "أخرى"];

const initialState = {
  purchases: [] as Purchase[],
  sales: [] as Sale[],
  expenses: [] as Expense[],
  losses: [] as Loss[],
  budgets: {} as Record<string, number>,
};

interface Purchase {
  id: number;
  date: string;
  count: number;
  price: number;
  note: string;
}

interface Sale {
  id: number;
  date: string;
  count: number;
  price: number;
  reason: string;
  note: string;
}

interface Expense {
  id: number;
  date: string;
  amount: number;
  category: string;
  note: string;
}

interface Loss {
  id: number;
  date: string;
  count: number;
  reason: string;
  note: string;
}

const STORAGE_KEY = "sheep-farm-data";

const formatCurrency = (n: number | undefined) =>
  new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 0 }).format(n ?? 0);

const today = () => new Date().toISOString().split("T")[0];

const C = {
  bg: "#0f1a10",
  card: "#152016",
  cardBorder: "#2a4a2e",
  accent: "#7ec850",
  accentDim: "#4a8a28",
  gold: "#e8c84a",
  red: "#e05a4a",
  text: "#d4e8c8",
  muted: "#7a9c72",
  white: "#f0f8ec",
};

const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 16,
  padding: "20px 24px",
};

const inputStyle: React.CSSProperties = {
  background: "#0a120b",
  border: `1px solid ${C.cardBorder}`,
  borderRadius: 8,
  color: C.text,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

const btnStyle = (variant: "primary" | "danger" | "secondary" = "primary"): React.CSSProperties => ({
  padding: "9px 20px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: 14,
  background: variant === "primary" ? C.accent : variant === "danger" ? C.red : "#1e3020",
  color: variant === "primary" ? "#0f1a10" : C.white,
  transition: "opacity 0.15s",
});

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: 600 }}>
    {children}
  </div>
);

const KPI = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
  <div style={{ ...cardStyle, textAlign: "center", flex: 1, minWidth: 140 }}>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || C.accent, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);

const TABS = ["لوحة التحكم", "الشراء", "البيع", "المصاريف", "الخسائر", "السجل", "الميزانية"];

export default function SheepTracker() {
  const [data, setData] = useState(initialState);
  const [tab, setTab] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("ios-install-dismissed");
    if (isIos && !isStandalone && !dismissed) {
      setShowIosBanner(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const installedHandler = () => setAppInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const dismissIosBanner = () => {
    setShowIosBanner(false);
    localStorage.setItem("ios-install-dismissed", "1");
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setAppInstalled(true);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setData(JSON.parse(saved));
      }
    } catch (_) {}
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Storage save failed:", e);
    }
  }, [data, storageReady]);

  const restoreInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await generatePDFReport(data, stats, chartRef.current);
    } finally {
      setPdfLoading(false);
    }
  };

  const backupData = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sheep-farm-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed && typeof parsed === "object") {
          setData({ ...initialState, ...parsed });
          alert("تم استعادة البيانات بنجاح ✓");
        } else {
          alert("الملف غير صالح");
        }
      } catch {
        alert("حدث خطأ في قراءة الملف");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const [pForm, setPForm] = useState({ date: today(), count: "", price: "", note: "" });
  const [sForm, setSForm] = useState({ date: today(), count: "", price: "", reason: "بيع عادي", note: "" });
  const [eForm, setEForm] = useState({ date: today(), amount: "", category: "علف", note: "" });

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── End-of-month download reminder
  const REMINDER_KEY = "sheep-farm-reminder-dismissed";
  const nowDate = new Date();
  const lastDayOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const daysLeft = lastDayOfMonth - nowDate.getDate();
  const isEndOfMonth = daysLeft <= 3;
  const thisMonthTag = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const dismissedMonth = (() => { try { return localStorage.getItem(REMINDER_KEY) ?? ""; } catch { return ""; } })();
  const [reminderDismissed, setReminderDismissed] = useState(dismissedMonth === thisMonthTag);
  const showReminder = isEndOfMonth && !reminderDismissed && (data.purchases.length > 0 || data.sales.length > 0 || data.expenses.length > 0);

  const dismissReminder = () => {
    try { localStorage.setItem(REMINDER_KEY, thisMonthTag); } catch (_) {}
    setReminderDismissed(true);
  };

  const clearAllData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setData(initialState);
    setShowClearConfirm(false);
  };

  const stats = useMemo(() => {
    const totalBought = data.purchases.reduce((s, p) => s + p.count, 0);
    const totalSold = data.sales.reduce((s, s2) => s + s2.count, 0);
    const totalLost = (data.losses ?? []).reduce((s, l) => s + l.count, 0);
    const current = totalBought - totalSold - totalLost;

    const costBought = data.purchases.reduce((s, p) => s + p.count * p.price, 0);
    const revenueSold = data.sales.reduce((s, s2) => s + s2.count * s2.price, 0);
    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
    const personalExpenses = data.expenses
      .filter((e) => e.category === "مصاريف شخصية")
      .reduce((s, e) => s + e.amount, 0);
    const operationalExpenses = totalExpenses - personalExpenses;

    const avgBuy = totalBought ? costBought / totalBought : 0;
    const avgSell = totalSold ? revenueSold / totalSold : 0;

    const lossValue = totalLost * avgBuy;
    const assetValue = current * avgBuy;
    const netProfit = revenueSold - costBought - totalExpenses - lossValue;

    const emergencySales = data.sales
      .filter((s) => s.reason !== "بيع عادي")
      .reduce((s, s2) => s + s2.count, 0);

    return {
      totalBought, totalSold, totalLost, current,
      costBought, revenueSold, totalExpenses, personalExpenses, operationalExpenses,
      avgBuy, avgSell, assetValue, netProfit, lossValue,
      emergencySales,
    };
  }, [data]);

  const addPurchase = () => {
    if (!pForm.count || !pForm.price) return;
    setData((d) => ({
      ...d,
      purchases: [
        ...d.purchases,
        { id: Date.now(), date: pForm.date, count: +pForm.count, price: +pForm.price, note: pForm.note },
      ],
    }));
    setPForm({ date: today(), count: "", price: "", note: "" });
  };

  const addSale = () => {
    if (!sForm.count || !sForm.price) return;
    setData((d) => ({
      ...d,
      sales: [
        ...d.sales,
        { id: Date.now(), date: sForm.date, count: +sForm.count, price: +sForm.price, reason: sForm.reason, note: sForm.note },
      ],
    }));
    setSForm({ date: today(), count: "", price: "", reason: "بيع عادي", note: "" });
  };

  const addExpense = () => {
    if (!eForm.amount) return;
    setData((d) => ({
      ...d,
      expenses: [
        ...d.expenses,
        { id: Date.now(), date: eForm.date, amount: +eForm.amount, category: eForm.category, note: eForm.note },
      ],
    }));
    setEForm({ date: today(), amount: "", category: "علف", note: "" });
  };

  const [lForm, setLForm] = useState({ date: today(), count: "", reason: LOSS_REASONS[0], note: "" });

  const addLoss = () => {
    if (!lForm.count) return;
    setData((d) => ({
      ...d,
      losses: [
        ...(d.losses ?? []),
        { id: Date.now(), date: lForm.date, count: +lForm.count, reason: lForm.reason, note: lForm.note },
      ],
    }));
    setLForm({ date: today(), count: "", reason: LOSS_REASONS[0], note: "" });
  };

  const deleteItem = (type: "purchases" | "sales" | "expenses" | "losses", id: number) => {
    setData((d) => ({ ...d, [type]: (d[type] as { id: number }[]).filter((x) => x.id !== id) }));
  };

  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({});

  const saveBudget = (category: string) => {
    const val = parseFloat(budgetEdits[category] ?? "");
    if (isNaN(val) || val < 0) return;
    setData((d) => ({ ...d, budgets: { ...d.budgets, [category]: val } }));
    setBudgetEdits((e) => { const next = { ...e }; delete next[category]; return next; });
  };

  const currentMonthKey = new Date().toISOString().slice(0, 7);

  const budgetStats = useMemo(() => {
    return EXPENSE_CATEGORIES.map((cat) => {
      const budget = data.budgets?.[cat] ?? 0;
      const actual = data.expenses
        .filter((e) => e.category === cat && e.date.startsWith(currentMonthKey))
        .reduce((s, e) => s + e.amount, 0);
      const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
      const over = budget > 0 && actual > budget;
      const barColor = over ? C.red : pct >= 75 ? C.gold : C.accent;
      return { cat, budget, actual, pct, over, barColor };
    });
  }, [data.expenses, data.budgets, currentMonthKey]);

  const totalBudget = budgetStats.reduce((s, b) => s + b.budget, 0);
  const totalActual = budgetStats.reduce((s, b) => s + b.actual, 0);

  const profitColor = stats.netProfit >= 0 ? C.accent : C.red;

  if (!storageReady) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI','Cairo','Tahoma',sans-serif" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐑</div>
          <div>جاري تحميل البيانات...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Segoe UI', 'Cairo', 'Tahoma', sans-serif",
        padding: "0 0 40px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1a3a1c 0%, #0f1a10 60%)",
          borderBottom: `2px solid ${C.cardBorder}`,
          padding: "20px 24px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 36 }}>🐑</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.white, lineHeight: 1.1 }}>
            مشروع تربية الأغنام
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            نظام الإدارة المالية والمتابعة
          </div>
        </div>
        <div style={{ marginRight: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <div style={{ fontSize: 10, color: C.accentDim, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, display: "inline-block" }}></span>
            محفوظ تلقائياً
          </div>
          {showClearConfirm ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...btnStyle("danger"), padding: "4px 10px", fontSize: 11 }} onClick={clearAllData}>تأكيد المسح</button>
              <button style={{ ...btnStyle("secondary"), padding: "4px 10px", fontSize: 11 }} onClick={() => setShowClearConfirm(false)}>إلغاء</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {installPrompt && !appInstalled && (
                <button
                  style={{ background: C.accent, border: "none", borderRadius: 6, color: "#0f1a10", fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                  onClick={handleInstall}
                >
                  📲 تثبيت التطبيق
                </button>
              )}
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button
                  style={{ background: "none", border: `1px solid ${C.accentDim}`, borderRadius: 6, color: C.accent, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                  onClick={() => navigator.share({ title: "تربية الأغنام", text: "نظام إدارة مالية لمزرعة الأغنام", url: window.location.href })}
                >
                  🔗 مشاركة
                </button>
              )}
              <button
                style={{
                  background: pdfLoading ? "#1a3020" : C.accent,
                  border: "none", borderRadius: 6,
                  color: pdfLoading ? C.accent : "#0f1a10",
                  fontSize: 10, padding: "3px 8px", cursor: pdfLoading ? "wait" : "pointer",
                  fontFamily: "inherit", fontWeight: 700, opacity: pdfLoading ? 0.7 : 1,
                }}
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
              >
                {pdfLoading ? "⏳ جاري التحضير..." : "📄 تقرير PDF"}
              </button>
              <button
                style={{ background: "none", border: `1px solid ${C.accentDim}`, borderRadius: 6, color: C.accent, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => exportToCSV(data)}
              >
                ⬇ تصدير CSV
              </button>
              <button
                style={{ background: "none", border: `1px solid ${C.accentDim}`, borderRadius: 6, color: C.accent, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                onClick={backupData}
              >
                💾 نسخ احتياطي
              </button>
              <button
                style={{ background: "none", border: `1px solid ${C.accentDim}`, borderRadius: 6, color: C.accent, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => restoreInputRef.current?.click()}
              >
                📂 استعادة
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={restoreData}
              />
              <button
                style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 6, color: C.muted, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => setShowClearConfirm(true)}
              >
                🗑 مسح الكل
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── iOS install banner ── */}
      {showIosBanner && (
        <div style={{
          background: "#1a2e1a",
          border: `1px solid ${C.accentDim}`,
          borderRadius: 10,
          margin: "0 16px 12px",
          padding: "12px 14px",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          direction: "rtl",
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>📲</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>
              تثبيت التطبيق على الآيفون
            </div>
            <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
              ١. افتح هذه الصفحة في <strong style={{ color: C.accent }}>Safari</strong><br />
              ٢. اضغط على زر المشاركة <strong style={{ color: C.accent }}>⬆</strong> في الشريط السفلي<br />
              ٣. اختر <strong style={{ color: C.accent }}>"إضافة إلى الشاشة الرئيسية"</strong>
            </div>
          </div>
          <button
            onClick={dismissIosBanner}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── End-of-month reminder banner ── */}
      {showReminder && (
        <div style={{
          background: "linear-gradient(90deg, #1a2e0a 0%, #1a260a 100%)",
          borderBottom: `1px solid ${C.accentDim}`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
              تذكير: نهاية الشهر اقتربت
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {daysLeft === 0 ? "اليوم آخر يوم في الشهر" : `باقي ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} على نهاية الشهر`} — حمّل سجل بياناتك الآن
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...btnStyle("primary"), padding: "6px 14px", fontSize: 12 }}
              onClick={() => { exportToCSV(data); dismissReminder(); }}
            >
              ⬇ تحميل السجل
            </button>
            <button
              style={{ background: "none", border: `1px solid ${C.accentDim}`, borderRadius: 8, color: C.muted, fontSize: 11, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}
              onClick={dismissReminder}
            >
              تذكيرني الشهر القادم
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "12px 16px 0",
          borderBottom: `1px solid ${C.cardBorder}`,
          overflowX: "auto",
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              background: tab === i ? C.accent : "transparent",
              color: tab === i ? "#0f1a10" : C.muted,
              border: "none",
              borderRadius: "8px 8px 0 0",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 800, margin: "0 auto" }}>

        {tab === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <KPI label="الأغنام الحالية" value={`${stats.current} رأس`} color={C.accent} />
              <KPI label="إجمالي الشراء" value={`${stats.totalBought} رأس`} color={C.text} />
              <KPI label="إجمالي المبيعات" value={`${stats.totalSold} رأس`} color={C.text} />
              <KPI label="بيع طارئ" value={`${stats.emergencySales} رأس`} color={C.gold} sub="لتغطية مصاريف" />
              {stats.totalLost > 0 && (
                <KPI label="إجمالي الخسائر" value={`${stats.totalLost} رأس`} color={C.red} sub={`≈ ${formatCurrency(stats.lossValue)} ر.س`} />
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <KPI
                label="صافي الربح / الخسارة"
                value={`${formatCurrency(Math.abs(stats.netProfit))} ر.س`}
                color={profitColor}
                sub={stats.netProfit >= 0 ? "✅ ربح" : "⚠️ خسارة"}
              />
              <KPI
                label="قيمة الأغنام الحالية (تقريبي)"
                value={`${formatCurrency(stats.assetValue)} ر.س`}
                color={C.gold}
              />
              <KPI label="إجمالي المصاريف" value={`${formatCurrency(stats.totalExpenses)} ر.س`} color={C.red} />
            </div>

            {/* ── Expense split card ── */}
            {stats.totalExpenses > 0 && (
              <div style={{
                ...cardStyle,
                display: "flex", flexDirection: "column", gap: 14,
              }}>
                <div style={{ fontWeight: 700, color: C.white, fontSize: 14 }}>💸 تفصيل المصاريف</div>

                {/* Operational */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>
                      🔧 مصاريف التشغيل
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginRight: 6 }}>
                        (علف · حبوب · دواء · نقل · إيجار · تشغيلية · أخرى)
                      </span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>
                      {formatCurrency(stats.operationalExpenses)} ر.س
                    </span>
                  </div>
                  <div style={{ background: "#0a120b", borderRadius: 6, height: 10, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 6,
                      background: C.gold,
                      width: `${stats.totalExpenses > 0 ? (stats.operationalExpenses / stats.totalExpenses) * 100 : 0}%`,
                      transition: "width 0.4s",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    {stats.totalExpenses > 0
                      ? `${((stats.operationalExpenses / stats.totalExpenses) * 100).toFixed(1)}% من إجمالي المصاريف`
                      : "—"}
                  </div>
                </div>

                {/* Personal */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#c084fc", fontWeight: 700 }}>
                      👤 المصاريف الشخصية
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#c084fc" }}>
                      {formatCurrency(stats.personalExpenses)} ر.س
                    </span>
                  </div>
                  <div style={{ background: "#0a120b", borderRadius: 6, height: 10, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 6,
                      background: "#c084fc",
                      width: `${stats.totalExpenses > 0 ? (stats.personalExpenses / stats.totalExpenses) * 100 : 0}%`,
                      transition: "width 0.4s",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    {stats.totalExpenses > 0
                      ? `${((stats.personalExpenses / stats.totalExpenses) * 100).toFixed(1)}% من إجمالي المصاريف`
                      : "—"}
                  </div>
                </div>

                {/* Total row */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderTop: `1px solid ${C.cardBorder}`, paddingTop: 10,
                }}>
                  <span style={{ fontSize: 12, color: C.muted }}>الإجمالي</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.red }}>
                    {formatCurrency(stats.totalExpenses)} ر.س
                  </span>
                </div>
              </div>
            )}

            {/* ── Budget Alerts ── */}
            {(() => {
              const overBudget = budgetStats.filter((b) => b.over);
              const nearBudget = budgetStats.filter((b) => !b.over && b.budget > 0 && b.pct >= 75);
              const hasAnyBudget = budgetStats.some((b) => b.budget > 0);
              if (!hasAnyBudget) return null;
              if (overBudget.length === 0 && nearBudget.length === 0) {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "#0e2210", border: `1px solid #2a5a2a`,
                    borderRadius: 12, padding: "12px 16px",
                  }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>الميزانية تحت السيطرة</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>جميع التصنيفات ضمن الحدود المقررة هذا الشهر</div>
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {overBudget.map((b) => (
                    <div key={b.cat} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#1f0a0a", border: `1px solid #5a2a2a`,
                      borderRadius: 12, padding: "12px 16px",
                    }}>
                      <span style={{ fontSize: 20 }}>🚨</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>
                          تجاوز ميزانية {b.cat}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          صرفت {formatCurrency(b.actual)} ر.س من أصل {formatCurrency(b.budget)} ر.س
                        </div>
                      </div>
                      <button
                        onClick={() => setTab(6)}
                        style={{ background: "none", border: `1px solid #5a2a2a`, borderRadius: 6, color: C.red, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >
                        عرض الميزانية
                      </button>
                    </div>
                  ))}
                  {nearBudget.map((b) => (
                    <div key={b.cat} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#1a160a", border: `1px solid #5a4a1a`,
                      borderRadius: 12, padding: "12px 16px",
                    }}>
                      <span style={{ fontSize: 20 }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>
                          اقتربت من حد {b.cat}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          {Math.round(b.pct)}% مستخدم — صرفت {formatCurrency(b.actual)} من {formatCurrency(b.budget)} ر.س
                        </div>
                      </div>
                      <button
                        onClick={() => setTab(6)}
                        style={{ background: "none", border: `1px solid #5a4a1a`, borderRadius: 6, color: C.gold, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >
                        عرض الميزانية
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: C.white }}>📊 متوسطات الأسعار</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted }}>متوسط سعر الشراء</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{formatCurrency(stats.avgBuy)} ر.س</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted }}>متوسط سعر البيع</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.accent }}>{formatCurrency(stats.avgSell)} ر.س</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted }}>هامش الربح لكل رأس</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stats.avgSell - stats.avgBuy >= 0 ? C.accent : C.red }}>
                    {formatCurrency(stats.avgSell - stats.avgBuy)} ر.س
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: C.white }}>💰 ملخص مالي</div>
              {[
                { label: "إجمالي تكلفة الشراء", val: stats.costBought, color: C.red },
                { label: "إجمالي إيرادات البيع", val: stats.revenueSold, color: C.accent },
                { label: "إجمالي المصاريف التشغيلية", val: stats.totalExpenses, color: C.gold },
                { label: "صافي الربح", val: stats.netProfit, color: profitColor, bold: true },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: `1px solid ${C.cardBorder}`,
                    fontWeight: row.bold ? 700 : 400,
                  }}
                >
                  <span style={{ color: C.muted, fontSize: 14 }}>{row.label}</span>
                  <span style={{ color: row.color, fontSize: 15 }}>{formatCurrency(row.val)} ر.س</span>
                </div>
              ))}
            </div>

            <div ref={chartRef}>
              <MonthlyChart
                purchases={data.purchases}
                sales={data.sales}
                expenses={data.expenses}
                losses={data.losses ?? []}
              />
            </div>

            <div style={{ ...cardStyle, background: "#0e2210", borderColor: "#2a5a2a" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: C.accent }}>💡 نصائح لنمو المشروع</div>
              {[
                "حافظ على نسبة البيع الطارئ أقل من 10% من القطيع",
                "راجع متوسط سعر الشراء مقارنةً بالسوق كل دفعة",
                "خصص احتياطي نقدي يعادل تكاليف شهر علف على الأقل",
                "وثّق كل عملية مهما كانت صغيرة لتتبع الاتجاهات",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: C.text }}>
                  <span style={{ color: C.accent }}>✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: C.white }}>➕ تسجيل دفعة شراء</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>التاريخ</Label>
                  <input type="date" style={inputStyle} value={pForm.date}
                    onChange={(e) => setPForm({ ...pForm, date: e.target.value })} />
                </div>
                <div>
                  <Label>عدد الرؤوس</Label>
                  <input type="number" style={inputStyle} placeholder="مثال: 10" value={pForm.count}
                    onChange={(e) => setPForm({ ...pForm, count: e.target.value })} />
                </div>
                <div>
                  <Label>سعر الرأس الواحد (ر.س)</Label>
                  <input type="number" style={inputStyle} placeholder="مثال: 800" value={pForm.price}
                    onChange={(e) => setPForm({ ...pForm, price: e.target.value })} />
                </div>
                <div>
                  <Label>ملاحظة (اختياري)</Label>
                  <input type="text" style={inputStyle} placeholder="مثال: سوق الثلاثاء" value={pForm.note}
                    onChange={(e) => setPForm({ ...pForm, note: e.target.value })} />
                </div>
              </div>
              {pForm.count && pForm.price && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#0a1f0c", borderRadius: 8, fontSize: 13, color: C.gold }}>
                  💰 إجمالي هذه الدفعة: {formatCurrency(+pForm.count * +pForm.price)} ر.س
                </div>
              )}
              <button style={{ ...btnStyle("primary"), marginTop: 14 }} onClick={addPurchase}>
                تسجيل الشراء
              </button>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: C.white }}>📋 سجل الشراء</div>
              {data.purchases.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>لا توجد عمليات شراء بعد</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...data.purchases].reverse().map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#0a120b", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                      <div>
                        <span style={{ color: C.accent, fontWeight: 700 }}>{p.count} رأس</span>
                        <span style={{ color: C.muted, margin: "0 8px" }}>×</span>
                        <span style={{ color: C.text }}>{formatCurrency(p.price)} ر.س</span>
                        <span style={{ color: C.gold, marginRight: 8 }}>= {formatCurrency(p.count * p.price)} ر.س</span>
                        {p.note && <span style={{ color: C.muted, marginRight: 8 }}>| {p.note}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.muted, fontSize: 11 }}>{p.date}</span>
                        <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}
                          onClick={() => deleteItem("purchases", p.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: C.white }}>💵 تسجيل عملية بيع</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>التاريخ</Label>
                  <input type="date" style={inputStyle} value={sForm.date}
                    onChange={(e) => setSForm({ ...sForm, date: e.target.value })} />
                </div>
                <div>
                  <Label>عدد الرؤوس</Label>
                  <input type="number" style={inputStyle} placeholder="مثال: 5" value={sForm.count}
                    onChange={(e) => setSForm({ ...sForm, count: e.target.value })} />
                </div>
                <div>
                  <Label>سعر الرأس الواحد (ر.س)</Label>
                  <input type="number" style={inputStyle} placeholder="مثال: 1200" value={sForm.price}
                    onChange={(e) => setSForm({ ...sForm, price: e.target.value })} />
                </div>
                <div>
                  <Label>سبب البيع</Label>
                  <select style={{ ...inputStyle }} value={sForm.reason}
                    onChange={(e) => setSForm({ ...sForm, reason: e.target.value })}>
                    <option>بيع عادي</option>
                    <option>شراء علف</option>
                    <option>مصاريف تشغيلية</option>
                    <option>مصاريف شخصية</option>
                    <option>ضرورة طارئة</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Label>ملاحظة (اختياري)</Label>
                  <input type="text" style={inputStyle} placeholder="أي تفاصيل إضافية" value={sForm.note}
                    onChange={(e) => setSForm({ ...sForm, note: e.target.value })} />
                </div>
              </div>
              {sForm.count && sForm.price && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#0a1f0c", borderRadius: 8, fontSize: 13, color: C.gold }}>
                  💰 إجمالي هذه الصفقة: {formatCurrency(+sForm.count * +sForm.price)} ر.س
                </div>
              )}
              <button style={{ ...btnStyle("primary"), marginTop: 14 }} onClick={addSale}>
                تسجيل البيع
              </button>
            </div>

            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: C.white }}>📋 سجل البيع</div>
              {data.sales.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>لا توجد عمليات بيع بعد</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...data.sales].reverse().map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#0a120b", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                      <div>
                        <span style={{ color: C.accent, fontWeight: 700 }}>{s.count} رأس</span>
                        <span style={{ color: C.muted, margin: "0 8px" }}>×</span>
                        <span style={{ color: C.text }}>{formatCurrency(s.price)} ر.س</span>
                        <span style={{ color: C.gold, marginRight: 8 }}>= {formatCurrency(s.count * s.price)} ر.س</span>
                        <span style={{
                          marginRight: 8, padding: "2px 8px", borderRadius: 4, fontSize: 11,
                          background: s.reason === "بيع عادي" ? "#1a3a1c" : "#3a1a0a",
                          color: s.reason === "بيع عادي" ? C.accent : C.gold,
                        }}>{s.reason}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.muted, fontSize: 11 }}>{s.date}</span>
                        <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}
                          onClick={() => deleteItem("sales", s.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: C.white }}>📝 تسجيل مصروف</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>التاريخ</Label>
                  <input type="date" style={inputStyle} value={eForm.date}
                    onChange={(e) => setEForm({ ...eForm, date: e.target.value })} />
                </div>
                <div>
                  <Label>المبلغ (ر.س)</Label>
                  <input type="number" style={inputStyle} placeholder="مثال: 500" value={eForm.amount}
                    onChange={(e) => setEForm({ ...eForm, amount: e.target.value })} />
                </div>
                <div>
                  <Label>التصنيف</Label>
                  <select style={{ ...inputStyle }} value={eForm.category}
                    onChange={(e) => setEForm({ ...eForm, category: e.target.value })}>
                    <option>علف</option>
                    <option>حبوب</option>
                    <option>دواء وعلاج</option>
                    <option>نقل وشحن</option>
                    <option>إيجار</option>
                    <option>مصاريف تشغيلية</option>
                    <option>مصاريف شخصية</option>
                    <option>أخرى</option>
                  </select>
                </div>
                <div>
                  <Label>ملاحظة (اختياري)</Label>
                  <input type="text" style={inputStyle} placeholder="تفاصيل المصروف" value={eForm.note}
                    onChange={(e) => setEForm({ ...eForm, note: e.target.value })} />
                </div>
              </div>
              <button style={{ ...btnStyle("primary"), marginTop: 14 }} onClick={addExpense}>
                تسجيل المصروف
              </button>
            </div>

            {data.expenses.length > 0 && (() => {
              const byCat: Record<string, number> = {};
              data.expenses.forEach((e) => {
                byCat[e.category] = (byCat[e.category] || 0) + e.amount;
              });
              return (
                <div style={{ ...cardStyle }}>
                  <div style={{ fontWeight: 700, marginBottom: 12, color: C.white }}>📊 المصاريف حسب التصنيف</div>
                  {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} style={{ display: "flex", justifyContent: "space-between",
                      padding: "7px 0", borderBottom: `1px solid ${C.cardBorder}`, fontSize: 13 }}>
                      <span style={{ color: C.text }}>{cat}</span>
                      <span style={{ color: C.gold, fontWeight: 700 }}>{formatCurrency(amt)} ر.س</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: C.white }}>📋 سجل المصاريف</div>
              {data.expenses.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>لا توجد مصاريف مسجلة بعد</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...data.expenses].reverse().map((e) => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: "#0a120b", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                      <div>
                        <span style={{ color: C.red, fontWeight: 700 }}>{formatCurrency(e.amount)} ر.س</span>
                        <span style={{ marginRight: 8, padding: "2px 8px", borderRadius: 4, fontSize: 11,
                          background: "#3a1a0a", color: C.gold }}>{e.category}</span>
                        {e.note && <span style={{ color: C.muted, marginRight: 6 }}>| {e.note}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.muted, fontSize: 11 }}>{e.date}</span>
                        <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}
                          onClick={() => deleteItem("expenses", e.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Month summary */}
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: C.white }}>🎯 ميزانية الشهر الحالي</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                {new Date().toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}
              </div>
              {totalBudget > 0 ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: C.muted }}>إجمالي الميزانية</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{formatCurrency(totalBudget)} ر.س</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                    <span style={{ color: C.muted }}>إجمالي الصرف الفعلي</span>
                    <span style={{ color: totalActual > totalBudget ? C.red : C.accent, fontWeight: 700 }}>
                      {formatCurrency(totalActual)} ر.س
                    </span>
                  </div>
                  {/* overall bar */}
                  <div style={{ background: "#0a120b", borderRadius: 8, height: 10, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min((totalActual / totalBudget) * 100, 100)}%`,
                      background: totalActual > totalBudget ? C.red : totalActual / totalBudget >= 0.75 ? C.gold : C.accent,
                      borderRadius: 8,
                      transition: "width 0.4s",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: "left" }}>
                    {Math.round((totalActual / totalBudget) * 100)}% من الميزانية
                  </div>
                </>
              ) : (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                  حدد الميزانية لكل تصنيف أدناه لتفعيل المتابعة
                </div>
              )}
            </div>

            {/* Per-category rows */}
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 16, color: C.white }}>📋 الميزانية حسب التصنيف</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {budgetStats.map(({ cat, budget, actual, pct, over, barColor }) => {
                  const isEditing = cat in budgetEdits;
                  return (
                    <div key={cat}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{cat}</span>
                          {over && (
                            <span style={{ fontSize: 10, background: "#3a0a0a", color: C.red, borderRadius: 4, padding: "1px 6px" }}>
                              تجاوز الميزانية
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {formatCurrency(actual)} / {budget > 0 ? formatCurrency(budget) : "—"} ر.س
                          </span>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input
                                type="number"
                                value={budgetEdits[cat]}
                                onChange={(e) => setBudgetEdits((prev) => ({ ...prev, [cat]: e.target.value }))}
                                style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 12 }}
                                placeholder="المبلغ"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && saveBudget(cat)}
                              />
                              <button
                                style={{ ...btnStyle("primary"), padding: "4px 10px", fontSize: 11 }}
                                onClick={() => saveBudget(cat)}
                              >حفظ</button>
                              <button
                                style={{ ...btnStyle("secondary"), padding: "4px 8px", fontSize: 11 }}
                                onClick={() => setBudgetEdits((e) => { const n = { ...e }; delete n[cat]; return n; })}
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 6, color: C.muted, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                              onClick={() => setBudgetEdits((prev) => ({ ...prev, [cat]: String(budget || "") }))}
                            >
                              ✏ تعديل
                            </button>
                          )}
                        </div>
                      </div>
                      {/* progress bar */}
                      <div style={{ background: "#0a120b", borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: budget > 0 ? `${pct}%` : "0%",
                          background: barColor,
                          borderRadius: 6,
                          transition: "width 0.4s",
                        }} />
                      </div>
                      {budget === 0 && (
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>لم يتم تحديد ميزانية</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tips */}
            <div style={{ ...cardStyle, background: "#0e2210", borderColor: "#2a5a2a" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: C.accent }}>💡 كيفية استخدام الميزانية</div>
              {[
                "حدد مبلغاً شهرياً لكل تصنيف بالضغط على تعديل",
                "الشريط الأخضر: أقل من 75% من الميزانية — ممتاز",
                "الشريط الذهبي: بين 75% و100% — تنبّه",
                "الشريط الأحمر: تجاوزت الميزانية — راجع مصاريفك",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: C.text }}>
                  <span style={{ color: C.accent }}>✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Loss form */}
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: C.white }}>➕ تسجيل خسارة جديدة</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <Label>التاريخ</Label>
                    <input type="date" style={inputStyle} value={lForm.date} onChange={(e) => setLForm((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Label>عدد الرؤوس</Label>
                    <input type="number" min="1" placeholder="0" style={inputStyle} value={lForm.count} onChange={(e) => setLForm((f) => ({ ...f, count: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <Label>سبب الخسارة</Label>
                    <select style={inputStyle} value={lForm.reason} onChange={(e) => setLForm((f) => ({ ...f, reason: e.target.value }))}>
                      {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>ملاحظات (اختياري)</Label>
                  <input type="text" placeholder="تفاصيل إضافية..." style={inputStyle} value={lForm.note} onChange={(e) => setLForm((f) => ({ ...f, note: e.target.value }))} />
                </div>
                <button style={btnStyle("danger")} onClick={addLoss}>تسجيل الخسارة</button>
              </div>
            </div>

            {/* Loss list */}
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: C.white }}>📋 سجل الخسائر</div>
              {(data.losses ?? []).length === 0 ? (
                <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>لا توجد خسائر مسجلة — الحمد لله</div>
              ) : (
                [...(data.losses ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((l) => (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0a120b", borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>💀</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>
                        {l.count} رأس
                        <span style={{ color: C.muted, fontWeight: 400 }}> — {l.reason}</span>
                      </div>
                      {l.note && <div style={{ fontSize: 11, color: C.muted }}>{l.note}</div>}
                      <div style={{ fontSize: 11, color: C.muted }}>{l.date}</div>
                    </div>
                    <button onClick={() => deleteItem("losses", l.id)} style={{ background: "none", border: `1px solid ${C.cardBorder}`, borderRadius: 6, color: C.red, fontSize: 11, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>حذف</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: C.white }}>📜 سجل جميع العمليات</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>مرتبة من الأحدث للأقدم</div>
              {(() => {
                const all = [
                  ...data.purchases.map((p) => ({ ...p, type: "شراء", amount: p.count * p.price, color: C.red, icon: "🛒", category: undefined, reason: undefined })),
                  ...data.sales.map((s) => ({ ...s, type: "بيع", amount: s.count * s.price, color: C.accent, icon: "💵", category: undefined })),
                  ...data.expenses.map((e) => ({ ...e, type: "مصروف", color: C.gold, icon: "📝", count: undefined, reason: undefined })),
                  ...(data.losses ?? []).map((l) => ({ ...l, type: "خسارة", amount: 0, color: C.red, icon: "💀", category: undefined, price: undefined })),
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (all.length === 0)
                  return <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>لا توجد عمليات بعد — ابدأ بتسجيل أول عملية</div>;

                return all.map((item) => (
                  <div key={`${item.id}-${item.type}`} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", background: "#0a120b", borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: item.color, fontWeight: 700 }}>
                        {item.type}
                        {item.count != null && <span style={{ color: C.muted, fontWeight: 400 }}> — {item.count} رأس</span>}
                        {item.category && <span style={{ color: C.muted, fontWeight: 400 }}> — {item.category}</span>}
                        {item.reason && item.reason !== "بيع عادي" && (
                          <span style={{ color: C.gold, fontWeight: 400 }}> ({item.reason})</span>
                        )}
                      </div>
                      {item.note && <div style={{ fontSize: 11, color: C.muted }}>{item.note}</div>}
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: item.color, fontWeight: 700, fontSize: 14 }}>{formatCurrency(item.amount)} ر.س</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{item.date}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
