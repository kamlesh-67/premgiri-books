import { Bell, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { navGroups } from "./navConfig";

function buildBreadcrumb(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/" || pathname === "/dashboard") {
    return [{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }];
  }
  // Find matching nav item
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.url || pathname.startsWith(item.url + "/")) {
        const crumbs: { label: string; href?: string }[] = [{ label: "Home", href: "/dashboard" }];
        if (group.label) crumbs.push({ label: group.label });
        crumbs.push({ label: item.title });
        return crumbs;
      }
    }
  }
  return [{ label: "Home", href: "/dashboard" }];
}

export function Topbar() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <SidebarTrigger className="md:hidden" />

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 items-center md:flex">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/60">/</span>}
              {c.href ? (
                <Link to={c.href} className="text-muted-foreground hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className={i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="hidden lg:block">
        <label className="relative block w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search vouchers, parties, items…"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-16 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </label>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          A
        </div>
      </div>
    </header>
  );
}
