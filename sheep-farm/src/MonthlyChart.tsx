import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Purchase { date: string; count: number; price: number; }
interface Sale { date: string; count: number; price: number; }
interface Expense { date: string; amount: number; }
interface Loss { date: string; count: number; }

interface Props {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  losses?: Loss[];
}

const C = {
  bg: "#0f1a10",
  card: "#152016",
  cardBorder: "#2a4a2e",
  accent: "#7ec850",
  gold: "#e8c84a",
  red: "#e05a4a",
  lossBar: "#c0392b",
  text: "#d4e8c8",
  muted: "#7a9c72",
  white: "#f0f8ec",
};

const MONTH_NAMES: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function formatMonth(key: string) {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[month]} ${year}`;
}

function formatNum(n: number) {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "#0e1f10",
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 13,
      direction: "rtl",
      minWidth: 180,
    }}>
      <div style={{ color: C.white, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {payload.map((entry) => {
        const isCount = entry.name === "الخسائر (رأس)";
        return (
          <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
            <span style={{ color: C.muted }}>{entry.name}</span>
            <span style={{ color: entry.color, fontWeight: 700 }}>
              {isCount
                ? `${Math.abs(entry.value)} رأس`
                : `${entry.value >= 0 ? "" : "-"}${Math.abs(entry.value).toLocaleString("ar-SA")} ر.س`
              }
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LossTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "#0e1f10",
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 13,
      direction: "rtl",
      minWidth: 160,
    }}>
      <div style={{ color: C.white, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ color: C.muted }}>{entry.name}</span>
          <span style={{ color: entry.color, fontWeight: 700 }}>{Math.abs(entry.value)} رأس</span>
        </div>
      ))}
    </div>
  );
}

export default function MonthlyChart({ purchases, sales, expenses, losses = [] }: Props) {
  const monthMap: Record<string, { revenue: number; cost: number; expensesAmt: number; lossCount: number; avgBuy: number }> = {};

  const ensure = (key: string) => {
    if (!monthMap[key]) monthMap[key] = { revenue: 0, cost: 0, expensesAmt: 0, lossCount: 0, avgBuy: 0 };
  };

  let totalBought = 0;
  let totalCost = 0;

  purchases.forEach((p) => {
    const key = p.date.slice(0, 7);
    ensure(key);
    monthMap[key].cost += p.count * p.price;
    totalBought += p.count;
    totalCost += p.count * p.price;
  });

  const globalAvgBuy = totalBought > 0 ? totalCost / totalBought : 0;

  sales.forEach((s) => {
    const key = s.date.slice(0, 7);
    ensure(key);
    monthMap[key].revenue += s.count * s.price;
  });

  expenses.forEach((e) => {
    const key = e.date.slice(0, 7);
    ensure(key);
    monthMap[key].expensesAmt += e.amount;
  });

  losses.forEach((l) => {
    const key = l.date.slice(0, 7);
    ensure(key);
    monthMap[key].lossCount += l.count;
  });

  const sorted = Object.keys(monthMap).sort();
  const hasLosses = losses.length > 0;

  let cumulative = 0;
  const chartData = sorted.map((key) => {
    const { revenue, cost, expensesAmt, lossCount } = monthMap[key];
    const lossValue = lossCount * globalAvgBuy;
    const net = revenue - cost - expensesAmt - lossValue;
    cumulative += net;
    return {
      month: formatMonth(key),
      "إيرادات البيع": revenue,
      "تكلفة الشراء": -cost,
      "المصاريف": -expensesAmt,
      ...(hasLosses ? { "قيمة الخسائر": -lossValue } : {}),
      "صافي الشهر": net,
      "الربح التراكمي": cumulative,
    };
  });

  const lossChartData = sorted
    .filter((key) => monthMap[key].lossCount > 0)
    .map((key) => ({
      month: formatMonth(key),
      "الخسائر (رأس)": monthMap[key].lossCount,
    }));

  if (chartData.length === 0) {
    return (
      <div style={{
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        padding: "32px 24px",
        textAlign: "center",
        color: C.muted,
        fontSize: 13,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
        <div>سيظهر هنا مخطط الأرباح الشهرية بعد تسجيل أولى العمليات</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Financial chart ── */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        padding: "20px 24px",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: C.white }}>📈 الأداء المالي الشهري</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>إيرادات ومصاريف وصافي الربح التراكمي</div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: C.muted, fontSize: 11 }}
              axisLine={{ stroke: C.cardBorder }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNum}
              tick={{ fill: C.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 12, direction: "rtl" }} />
            <ReferenceLine y={0} stroke={C.cardBorder} strokeWidth={1.5} />

            <Bar dataKey="إيرادات البيع" fill={C.accent} fillOpacity={0.85} radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="تكلفة الشراء" fill={C.red} fillOpacity={0.75} stackId="a" />
            <Bar dataKey="المصاريف" fill={C.gold} fillOpacity={0.75} stackId="a" />
            {hasLosses && (
              <Bar dataKey="قيمة الخسائر" fill={C.lossBar} fillOpacity={0.85} radius={[0, 0, 4, 4]} stackId="a" />
            )}

            <Line
              type="monotone"
              dataKey="الربح التراكمي"
              stroke="#a0d8f8"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#a0d8f8", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {chartData.length > 1 && (() => {
          const last = chartData[chartData.length - 1];
          const cumProfit = last["الربح التراكمي"];
          const isPos = cumProfit >= 0;
          return (
            <div style={{
              marginTop: 16,
              padding: "10px 14px",
              background: isPos ? "#0e2210" : "#1f0e0e",
              borderRadius: 10,
              border: `1px solid ${isPos ? "#2a5a2a" : "#5a2a2a"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}>
              <span style={{ color: C.muted }}>الربح التراكمي الإجمالي حتى الآن</span>
              <span style={{ color: isPos ? C.accent : C.red, fontWeight: 800, fontSize: 16 }}>
                {isPos ? "+" : ""}{cumProfit.toLocaleString("ar-SA")} ر.س
              </span>
            </div>
          );
        })()}
      </div>

      {/* ── Monthly losses chart (shown only when there are losses) ── */}
      {hasLosses && lossChartData.length > 0 && (
        <div style={{
          background: C.card,
          border: `1px solid #5a2a2a`,
          borderRadius: 16,
          padding: "20px 24px",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: C.white }}>💀 الخسائر الشهرية</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>عدد رؤوس الخسائر (نفوق / ضياع / سرقة) لكل شهر</div>

          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={lossChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.cardBorder} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: C.muted, fontSize: 11 }}
                axisLine={{ stroke: C.cardBorder }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}`}
                tick={{ fill: C.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip content={<LossTooltip />} />
              <Bar dataKey="الخسائر (رأس)" fill={C.lossBar} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>

          <div style={{
            marginTop: 12,
            padding: "8px 14px",
            background: "#1f0e0e",
            borderRadius: 10,
            border: "1px solid #5a2a2a",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
          }}>
            <span style={{ color: C.muted }}>إجمالي الخسائر المسجلة</span>
            <span style={{ color: C.red, fontWeight: 800 }}>
              {losses.reduce((s, l) => s + l.count, 0)} رأس
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
