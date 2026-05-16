# 🎨 Design Consistency Skill — PaintPro Manager
> Load this skill before building ANY page or UI component.
> This enforces uniform look across all 20 pages.

---

## STEP 1 — CHECK BEFORE BUILDING

Before writing a single line of UI code, answer these:

- [ ] Does the page use `DashboardLayout` (sidebar + topbar)?
- [ ] Are stat cards using the shared `<StatCard>` component?
- [ ] Are status badges using `<StatusBadge status="..." />`?
- [ ] Are tables using the `<DataTable>` pattern (not custom table HTML)?
- [ ] Is the page header using `<PageHeader title subtitle action />`?
- [ ] Is purple ONLY `purple-600` / `#7C3AED`? No other purple shades?
- [ ] Is all text using gray-900 / gray-700 / gray-500 / gray-400 scale?
- [ ] Are all cards using `bg-white rounded-lg shadow-sm border border-gray-100`?

If any answer is NO — fix it before submitting.

---

## STEP 2 — PAGE TEMPLATE (copy this for every new page)

```tsx
// app/(dashboard)/[page-name]/page.tsx
"use client"

import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { SectionCard } from "@/components/ui/section-card"
// import other shared components as needed

export default function [PageName]Page() {
  return (
    <div className="p-6 space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Page Title"
        subtitle="Brief description of what this page does"
        action={/* Optional: <Button> + New Thing </Button> */}
      />

      {/* 2. Stat Cards Row (if applicable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard ... />
        <StatCard ... />
        <StatCard ... />
        <StatCard ... />
      </div>

      {/* 3. Main Content */}
      <SectionCard>
        {/* table, chart, form, etc. */}
      </SectionCard>
    </div>
  )
}
```

---

## STEP 3 — COMPONENT PROPS REFERENCE

### StatCard
```tsx
<StatCard
  title="Today's Revenue"
  value="₹48,250"
  change="+12.4% vs yesterday"
  changeType="positive"          // "positive" | "negative" | "neutral"
  icon={IndianRupee}             // Lucide icon component
  iconBg="bg-purple-100"
  iconColor="text-purple-600"
/>
```
**Icon background colors to use:**
- Revenue/Money: `bg-purple-100` + `text-purple-600`
- Alerts/Warnings: `bg-amber-100` + `text-amber-600`  
- Documents/Invoices: `bg-blue-100` + `text-blue-600`
- Orders/Cart: `bg-green-100` + `text-green-600`
- Danger/Overdue: `bg-red-100` + `text-red-600`

### StatusBadge — Status → Color Mapping
```
"paid"        → bg-green-100  text-green-700
"received"    → bg-green-100  text-green-700
"completed"   → bg-green-100  text-green-700
"healthy"     → bg-green-100  text-green-700
"active"      → bg-green-100  text-green-700
"approved"    → bg-blue-100   text-blue-700
"processing"  → bg-blue-100   text-blue-700
"in-transit"  → bg-blue-100   text-blue-700
"pending"     → bg-amber-100  text-amber-700
"low"         → bg-amber-100  text-amber-700
"soon"        → bg-amber-100  text-amber-700
"maintenance" → bg-amber-100  text-amber-700
"overdue"     → bg-red-100    text-red-700
"critical"    → bg-red-100    text-red-700
"urgent"      → bg-red-100    text-red-700
"error"       → bg-red-100    text-red-700
"out-of-stock"→ bg-red-100    text-red-700
"draft"       → bg-gray-100   text-gray-600
"cancelled"   → bg-gray-100   text-gray-600
"ok"          → bg-gray-100   text-gray-600
"offline"     → bg-gray-100   text-gray-600
```

### Action Buttons (in tables)
```tsx
// View action
<button className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors">
  <Eye className="w-4 h-4" />
</button>

// Download action  
<button className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors">
  <Download className="w-4 h-4" />
</button>

// Edit action
<button className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors">
  <Pencil className="w-4 h-4" />
</button>

// Delete action
<button className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
  <Trash2 className="w-4 h-4" />
</button>
```

### Primary Action Button (top-right of page)
```tsx
<button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
  <Plus className="w-4 h-4" />
  New [Thing]
</button>
```

### Table Structure
```tsx
<div className="overflow-x-auto">
  <table className="w-full">
    <thead>
      <tr className="bg-gray-50 border-b border-gray-100">
        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">
          Column Name
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm text-gray-700">
          Value
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Chart Colors (Recharts)
```
Primary line/bar:   #7C3AED  (purple-600)
Secondary line:     #10B981  (green-500)
Tertiary line:      #F59E0B  (amber-400)
Chart grid:         #F3F4F6  (gray-100)
Axis text:          #9CA3AF  (gray-400)
Tooltip bg:         #FFFFFF
Tooltip border:     #E5E7EB  (gray-200)
```

---

## STEP 4 — SIDEBAR ACTIVE STATE RULES

```tsx
// Active nav item
className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium bg-purple-50 text-purple-700"

// Inactive nav item  
className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"

// Nav group label
className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest"
```

---

## STEP 5 — TOPBAR STRUCTURE

```tsx
<header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center px-4 gap-4">
  {/* Logo — left */}
  <div className="w-[212px] flex items-center gap-2.5 shrink-0">
    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
      <Palette className="w-4 h-4 text-white" />
    </div>
    <span className="font-bold text-gray-900 text-sm">PaintPro Manager</span>
  </div>

  {/* Breadcrumb */}
  <nav className="flex items-center gap-1.5 text-sm text-gray-500">
    <span>Home</span>
    <ChevronRight className="w-3.5 h-3.5" />
    <span className="text-gray-900 font-medium">Current Page</span>
  </nav>

  {/* Search — center */}
  <div className="flex-1 max-w-md mx-auto relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-purple-300 focus:ring-1 focus:ring-purple-200 outline-none" placeholder="Search anything..." />
  </div>

  {/* Right actions */}
  <div className="flex items-center gap-2 ml-auto">
    {/* Bell with red dot */}
    <button className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md">
      <Bell className="w-5 h-5" />
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
    </button>
    {/* Avatar */}
    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer">
      A
    </div>
  </div>
</header>
```

---

## STEP 6 — COMMON MISTAKES TO AVOID

| ❌ Wrong | ✅ Correct |
|---|---|
| `text-purple-500` | `text-purple-600` |
| `bg-violet-600` | `bg-purple-600` |
| Custom `<table>` without shared classes | Use DataTable pattern |
| `<Badge>` from shadcn | Use `<StatusBadge>` custom component |
| Hard-coded `style={{color: '#7C3AED'}}` | `className="text-purple-600"` |
| Different card padding on different pages | Always `p-5` in SectionCard |
| Page without `<PageHeader>` | Always start with PageHeader |
| Sidebar without group labels | Always include OVERVIEW, ACCOUNTS & DOCUMENTS, etc. |
| Charts with random colors | Always use chart color palette above |

---

## STEP 7 — UNIFORM PAGE CHECKLIST (run before marking page complete)

```
□ Page wrapped in p-6 space-y-6 div
□ Uses <PageHeader> with correct title, subtitle
□ Stat cards (if any) in 4-column grid using <StatCard>
□ All content in <SectionCard> wrapper
□ Tables use correct thead/tbody styling
□ All statuses use <StatusBadge>
□ Action buttons use correct purple-600 style
□ Search uses <SearchInput> or matching pattern
□ Lucide icons (not heroicons or font-awesome)
□ No console errors
□ Looks identical in concept to the design screenshots
```
