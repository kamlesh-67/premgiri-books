import { LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navGroups } from "./navConfig";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { pathname } = useLocation();
  const isActive = (url: string) =>
    url === "/dashboard" ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 border-b border-sidebar-border">
        <div className="flex h-full items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            P
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-foreground">PremGiri Books</span>
            <span className="text-[10px] text-muted-foreground">Baba Premgiri Paints</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        {navGroups.map((group, i) => (
          <SidebarGroup key={group.label ?? `g-${i}`}>
            {group.label && (
              <SidebarGroupLabel className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <NavLink
                          to={item.url}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary-soft text-primary"
                              : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                          {item.shortcut && (
                            <span className="ml-auto text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                              {item.shortcut}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            A
          </div>
          <div className="flex flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-semibold text-foreground">Admin User</span>
            <span className="text-[10px] text-muted-foreground">Owner</span>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground group-data-[collapsible=icon]:hidden"
            aria-label="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
          FY 2024-25
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
