interface Purchase { id: number; date: string; count: number; price: number; note: string; }
interface Sale { id: number; date: string; count: number; price: number; reason: string; note: string; }
interface Expense { id: number; date: string; amount: number; category: string; note: string; }

interface FarmData {
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
}

function escapeCell(value: string | number | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cells: (string | number | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

export function exportToCSV(data: FarmData): void {
  const lines: string[] = [];

  const totalBought = data.purchases.reduce((s, p) => s + p.count, 0);
  const totalSold = data.sales.reduce((s, s2) => s + s2.count, 0);
  const costBought = data.purchases.reduce((s, p) => s + p.count * p.price, 0);
  const revenueSold = data.sales.reduce((s, s2) => s + s2.count * s2.price, 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = revenueSold - costBought - totalExpenses;

  lines.push(row("=== ملخص المشروع ==="));
  lines.push(row("البند", "القيمة"));
  lines.push(row("إجمالي الأغنام المشتراة", totalBought));
  lines.push(row("إجمالي الأغنام المباعة", totalSold));
  lines.push(row("القطيع الحالي", totalBought - totalSold));
  lines.push(row("إجمالي تكلفة الشراء (ر.س)", costBought));
  lines.push(row("إجمالي إيرادات البيع (ر.س)", revenueSold));
  lines.push(row("إجمالي المصاريف (ر.س)", totalExpenses));
  lines.push(row("صافي الربح / الخسارة (ر.س)", netProfit));
  lines.push("");

  lines.push(row("=== سجل الشراء ==="));
  lines.push(row("التاريخ", "عدد الرؤوس", "سعر الرأس (ر.س)", "الإجمالي (ر.س)", "ملاحظة"));
  const sortedPurchases = [...data.purchases].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of sortedPurchases) {
    lines.push(row(p.date, p.count, p.price, p.count * p.price, p.note));
  }
  if (data.purchases.length === 0) lines.push(row("لا توجد عمليات شراء"));
  lines.push("");

  lines.push(row("=== سجل البيع ==="));
  lines.push(row("التاريخ", "عدد الرؤوس", "سعر الرأس (ر.س)", "الإجمالي (ر.س)", "سبب البيع", "ملاحظة"));
  const sortedSales = [...data.sales].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sortedSales) {
    lines.push(row(s.date, s.count, s.price, s.count * s.price, s.reason, s.note));
  }
  if (data.sales.length === 0) lines.push(row("لا توجد عمليات بيع"));
  lines.push("");

  lines.push(row("=== سجل المصاريف ==="));
  lines.push(row("التاريخ", "المبلغ (ر.س)", "التصنيف", "ملاحظة"));
  const sortedExpenses = [...data.expenses].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sortedExpenses) {
    lines.push(row(e.date, e.amount, e.category, e.note));
  }
  if (data.expenses.length === 0) lines.push(row("لا توجد مصاريف"));
  lines.push("");

  const byCat: Record<string, number> = {};
  data.expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  if (Object.keys(byCat).length > 0) {
    lines.push(row("=== المصاريف حسب التصنيف ==="));
    lines.push(row("التصنيف", "الإجمالي (ر.س)"));
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt]) => lines.push(row(cat, amt)));
    lines.push("");
  }

  const BOM = "\uFEFF";
  const csv = BOM + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const dateStr = new Date().toISOString().split("T")[0];
  link.download = `مشروع-الأغنام-${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
