import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Purchase  { date: string; count: number; price: number; note: string; }
interface Sale      { date: string; count: number; price: number; reason: string; note: string; }
interface Expense   { date: string; amount: number; category: string; note: string; }
interface Loss      { date: string; count: number; reason: string; note: string; }

interface Stats {
  totalBought: number; totalSold: number; totalLost: number; current: number;
  costBought: number; revenueSold: number; totalExpenses: number;
  avgBuy: number; avgSell: number; assetValue: number; netProfit: number;
  lossValue: number; emergencySales: number;
}

interface Data {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  losses: Loss[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 0 }).format(n ?? 0);

const MONTH_AR: Record<string, string> = {
  "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
  "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
  "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
};

function fmtMonth(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_AR[m] ?? m} ${y}`;
}

function buildHtml(data: Data, stats: Stats, chartImgSrc: string | null): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const isProfit = stats.netProfit >= 0;

  /* ── Monthly aggregation ── */
  const monthMap: Record<string, { revenue: number; cost: number; expAmt: number; lossCount: number }> = {};
  const ensure = (k: string) => { if (!monthMap[k]) monthMap[k] = { revenue: 0, cost: 0, expAmt: 0, lossCount: 0 }; };
  data.purchases.forEach(p => { const k = p.date.slice(0,7); ensure(k); monthMap[k].cost += p.count * p.price; });
  data.sales.forEach(s => { const k = s.date.slice(0,7); ensure(k); monthMap[k].revenue += s.count * s.price; });
  data.expenses.forEach(e => { const k = e.date.slice(0,7); ensure(k); monthMap[k].expAmt += e.amount; });
  (data.losses ?? []).forEach(l => { const k = l.date.slice(0,7); ensure(k); monthMap[k].lossCount += l.count; });
  const months = Object.keys(monthMap).sort();

  /* ── Expense categories ── */
  const catMap: Record<string, number> = {};
  data.expenses.forEach(e => { catMap[e.category] = (catMap[e.category] ?? 0) + e.amount; });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  /* ── Loss by reason ── */
  const reasonMap: Record<string, number> = {};
  (data.losses ?? []).forEach(l => { reasonMap[l.reason] = (reasonMap[l.reason] ?? 0) + l.count; });
  const reasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);

  const kpiCard = (label: string, value: string, sub: string, color: string) => `
    <div style="background:#1a2e1a;border:1px solid #2a5a2a;border-radius:12px;padding:16px 12px;text-align:center;min-width:130px;flex:1">
      <div style="font-size:11px;color:#7a9c72;margin-bottom:6px;letter-spacing:1px">${label}</div>
      <div style="font-size:22px;font-weight:800;color:${color};line-height:1.1">${value}</div>
      ${sub ? `<div style="font-size:10px;color:#7a9c72;margin-top:4px">${sub}</div>` : ""}
    </div>`;

  const monthRows = months.map(k => {
    const { revenue, cost, expAmt, lossCount } = monthMap[k];
    const lossVal = lossCount * (stats.avgBuy ?? 0);
    const net = revenue - cost - expAmt - lossVal;
    const color = net >= 0 ? "#7ec850" : "#e05a4a";
    return `<tr>
      <td>${fmtMonth(k)}</td>
      <td style="color:#7ec850">${fmt(revenue)}</td>
      <td style="color:#e05a4a">${fmt(cost)}</td>
      <td style="color:#e8c84a">${fmt(expAmt)}</td>
      ${stats.totalLost > 0 ? `<td style="color:#c0392b">${lossCount > 0 ? lossCount + " رأس" : "—"}</td>` : ""}
      <td style="color:${color};font-weight:700">${net >= 0 ? "+" : ""}${fmt(net)}</td>
    </tr>`;
  }).join("");

  const expRows = cats.map(([cat, amt]) => {
    const pct = stats.totalExpenses > 0 ? ((amt / stats.totalExpenses) * 100).toFixed(1) : "0";
    return `<tr><td>${cat}</td><td style="color:#e8c84a">${fmt(amt)} ر.س</td><td style="color:#7a9c72">${pct}%</td></tr>`;
  }).join("");

  const lossRows = reasons.map(([r, cnt]) =>
    `<tr><td>${r}</td><td style="color:#e05a4a">${cnt} رأس</td></tr>`
  ).join("");

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Cairo", Arial, sans-serif;
    background: #0f1a10;
    color: #d4e8c8;
    direction: rtl;
    width: 900px;
    padding: 0;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1a3a1e; color: #7ec850; padding: 10px 12px; font-weight: 700; border-bottom: 2px solid #2a5a2a; }
  td { padding: 9px 12px; border-bottom: 1px solid #1e3020; color: #d4e8c8; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #152016; }
  .section-title {
    font-size: 15px; font-weight: 800; color: #f0f8ec;
    margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
  }
  .card { background: #152016; border: 1px solid #2a4a2e; border-radius: 14px; padding: 20px; margin-bottom: 20px; }
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div style="background:linear-gradient(135deg,#1a3a1e 0%,#0f1a10 60%,#152d10 100%);padding:32px 40px;border-bottom:3px solid #7ec850;margin-bottom:24px">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
    <div style="font-size:52px;line-height:1">🐑</div>
    <div>
      <div style="font-size:28px;font-weight:800;color:#f0f8ec;line-height:1.1">مشروع تربية الأغنام</div>
      <div style="font-size:14px;color:#7a9c72;margin-top:4px">نظام الإدارة المالية والمتابعة</div>
    </div>
    <div style="margin-right:auto;text-align:left">
      <div style="font-size:13px;color:#7a9c72">تاريخ التقرير</div>
      <div style="font-size:15px;font-weight:700;color:#7ec850;margin-top:2px">${dateStr}</div>
    </div>
  </div>
  <div style="display:flex;gap:12px;margin-top:8px">
    <div style="background:${isProfit ? "#0e2210" : "#1f0a0a"};border:1px solid ${isProfit ? "#2a5a2a" : "#5a2a2a"};border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;color:${isProfit ? "#7ec850" : "#e05a4a"}">
      ${isProfit ? "✅ المشروع رابح" : "⚠️ المشروع في خسارة"}
    </div>
    <div style="background:#1a2e1a;border:1px solid #2a5a2a;border-radius:10px;padding:8px 16px;font-size:13px;color:#7a9c72">
      القطيع الحالي: <strong style="color:#f0f8ec">${stats.current} رأس</strong>
    </div>
  </div>
</div>

<div style="padding:0 32px 32px">

<!-- ══ KPIs ══ -->
<div class="card">
  <div class="section-title">📊 ملخص الأداء الإجمالي</div>
  <div style="display:flex;flex-wrap:wrap;gap:10px">
    ${kpiCard("الأغنام الحالية", `${stats.current} رأس`, "", "#7ec850")}
    ${kpiCard("إجمالي الشراء", `${stats.totalBought} رأس`, `${fmt(stats.costBought)} ر.س`, "#d4e8c8")}
    ${kpiCard("إجمالي المبيعات", `${stats.totalSold} رأس`, `${fmt(stats.revenueSold)} ر.س`, "#d4e8c8")}
    ${kpiCard("صافي الربح / الخسارة", `${fmt(Math.abs(stats.netProfit))} ر.س`, isProfit ? "✅ ربح" : "⚠️ خسارة", isProfit ? "#7ec850" : "#e05a4a")}
    ${kpiCard("إجمالي المصاريف", `${fmt(stats.totalExpenses)} ر.س`, "", "#e8c84a")}
    ${kpiCard("قيمة القطيع الحالي", `${fmt(stats.assetValue)} ر.س`, "تقريبي", "#a0d8f8")}
    ${stats.totalLost > 0 ? kpiCard("إجمالي الخسائر", `${stats.totalLost} رأس`, `${fmt(stats.lossValue)} ر.س`, "#e05a4a") : ""}
    ${kpiCard("متوسط سعر الشراء", `${fmt(stats.avgBuy)} ر.س`, "للرأس الواحد", "#7a9c72")}
    ${kpiCard("متوسط سعر البيع", `${fmt(stats.avgSell)} ر.س`, "للرأس الواحد", "#7a9c72")}
  </div>
</div>

<!-- ══ CHART IMAGE ══ -->
${chartImgSrc ? `
<div class="card">
  <div class="section-title">📈 مخطط الأداء المالي الشهري</div>
  <img src="${chartImgSrc}" style="width:100%;border-radius:10px;margin-top:4px" />
</div>` : ""}

<!-- ══ MONTHLY BREAKDOWN ══ -->
${months.length > 0 ? `
<div class="card">
  <div class="section-title">📅 التفصيل الشهري</div>
  <table>
    <thead><tr>
      <th>الشهر</th>
      <th>الإيرادات</th>
      <th>تكلفة الشراء</th>
      <th>المصاريف</th>
      ${stats.totalLost > 0 ? "<th>الخسائر</th>" : ""}
      <th>صافي الشهر</th>
    </tr></thead>
    <tbody>${monthRows}</tbody>
  </table>
</div>` : ""}

<!-- ══ EXPENSE BREAKDOWN ══ -->
${cats.length > 0 ? `
<div class="card">
  <div class="section-title">💸 تفصيل المصاريف حسب الفئة</div>
  <table>
    <thead><tr><th>الفئة</th><th>المبلغ</th><th>النسبة</th></tr></thead>
    <tbody>${expRows}</tbody>
  </table>
  <div style="margin-top:12px;padding:10px 14px;background:#0e2210;border-radius:10px;display:flex;justify-content:space-between;font-size:13px">
    <span style="color:#7a9c72">إجمالي المصاريف</span>
    <span style="color:#e8c84a;font-weight:800">${fmt(stats.totalExpenses)} ر.س</span>
  </div>
</div>` : ""}

<!-- ══ LOSSES ══ -->
${reasons.length > 0 ? `
<div class="card" style="border-color:#5a2a2a">
  <div class="section-title">💀 تفصيل الخسائر حسب السبب</div>
  <table>
    <thead><tr><th>السبب</th><th>العدد</th></tr></thead>
    <tbody>${lossRows}</tbody>
  </table>
  <div style="margin-top:12px;padding:10px 14px;background:#1f0a0a;border:1px solid #5a2a2a;border-radius:10px;display:flex;justify-content:space-between;font-size:13px">
    <span style="color:#7a9c72">القيمة التقديرية للخسائر</span>
    <span style="color:#e05a4a;font-weight:800">${fmt(stats.lossValue)} ر.س</span>
  </div>
</div>` : ""}

<!-- ══ FOOTER ══ -->
<div style="margin-top:24px;padding:16px 20px;background:#152016;border:1px solid #2a4a2e;border-radius:12px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#7a9c72">
  <span>🐑 مشروع تربية الأغنام — نظام الإدارة المالية</span>
  <span>${dateStr}</span>
</div>

</div>
</body>
</html>`;
}

export async function generatePDFReport(
  data: Data,
  stats: Stats,
  chartEl: HTMLElement | null
): Promise<void> {
  /* ── 1. Capture chart as image ── */
  let chartImgSrc: string | null = null;
  if (chartEl) {
    try {
      const canvas = await html2canvas(chartEl, {
        backgroundColor: "#152016",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      chartImgSrc = canvas.toDataURL("image/png");
    } catch (_) { /* skip chart if capture fails */ }
  }

  /* ── 2. Build report HTML ── */
  const html = buildHtml(data, stats, chartImgSrc);

  /* ── 3. Render in hidden iframe ── */
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:0;left:-9999px;width:900px;height:1px;border:none;visibility:hidden";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  /* ── 4. Wait for fonts to load ── */
  await new Promise<void>((resolve) => {
    const loaded = () => resolve();
    if (iframeDoc.fonts) {
      iframeDoc.fonts.ready.then(loaded);
    } else {
      setTimeout(loaded, 800);
    }
  });
  await new Promise<void>((r) => setTimeout(r, 400));

  const reportEl = iframeDoc.body;

  /* ── 5. Capture full report ── */
  const canvas = await html2canvas(reportEl, {
    backgroundColor: "#0f1a10",
    scale: 2,
    useCORS: true,
    logging: false,
    width: 900,
    windowWidth: 900,
  });

  document.body.removeChild(iframe);

  /* ── 6. Build PDF (A4) ── */
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const A4_W = 210;
  const A4_H = 297;
  const imgW = A4_W;
  const imgH = (canvas.height / canvas.width) * imgW;
  const pages = Math.ceil(imgH / A4_H);

  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      -i * A4_H,
      imgW,
      imgH
    );
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  pdf.save(`تقرير-تربية-الاغنام-${stamp}.pdf`);
}
