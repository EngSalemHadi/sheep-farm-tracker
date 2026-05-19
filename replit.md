# مشروع تربية الأغنام

نظام إدارة مالية لمتابعة مشاريع تربية الأغنام — تسجيل الشراء والبيع والمصاريف مع لوحة تحكم وإحصائيات.

## Run & Operate

- `pnpm --filter @workspace/sheep-farm run dev` — run the web app (port assigned via workflow)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (sheep-farm artifact at `/`)
- Storage: localStorage (browser-side persistence, no backend needed)

## Where things live

- Main app component: `artifacts/sheep-farm/src/SheepTracker.tsx`
- Entry point: `artifacts/sheep-farm/src/App.tsx`
- Styles: `artifacts/sheep-farm/src/index.css`

## Product

Arabic RTL sheep farm financial management app with:
- Dashboard with KPIs (current herd count, profit/loss, asset value, averages)
- Purchase tracking (date, count, price per head, notes)
- Sales tracking (date, count, price, sale reason — normal vs. emergency)
- Expense tracking with category breakdown
- Full transaction log sorted by date
- Auto-save to localStorage

## User preferences

- Arabic RTL interface
- Dark green color theme (#0f1a10 bg, #7ec850 accent)
- All data persisted in browser localStorage under key "sheep-farm-data"
