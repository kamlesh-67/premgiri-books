import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { DataTable, type Column } from "@/components/primitives/DataTable";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RowActions } from "@/components/primitives/RowActions";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { TextInput, SelectInput } from "@/components/primitives/FormControls";
import { useCollection, remove, update, getCollection, type UserRow, type RoleRow } from "@/lib/mockStore";
import { UserForm } from "./forms/UserForm";

export default function Users() {
  const rows = useCollection("users");
  const roles = useCollection("roles");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      const matchR = !roleFilter || r.role === roleFilter;
      return matchQ && matchR;
    });
  }, [rows, query, roleFilter]);

  const onDelete = (u: UserRow) => {
    remove("users", u.id);
    // recalc role counts
    const all = getCollection("users");
    const counts = new Map<string, number>();
    all.forEach((x) => counts.set(x.role, (counts.get(x.role) ?? 0) + 1));
    getCollection("roles").forEach((r) => {
      const next = counts.get(r.name) ?? 0;
      if (next !== r.users) update("roles", r.name, { users: next });
    });
    toast.success(`${u.name} removed`);
    setToDelete(null);
  };

  const onAssignRole = (u: UserRow, role: string) => {
    if (role === u.role) return;
    update("users", u.id, { role });
    const all = getCollection("users");
    const counts = new Map<string, number>();
    all.forEach((x) => counts.set(x.role, (counts.get(x.role) ?? 0) + 1));
    getCollection("roles").forEach((r) => {
      const next = counts.get(r.name) ?? 0;
      if (next !== r.users) update("roles", r.name, { users: next });
    });
    toast.success(`${u.name} → ${role}`);
  };

  const cols: Column<UserRow>[] = [
    { key: "name", header: "User", cell: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{r.name.charAt(0)}</div>
        <div>
          <p className="font-medium leading-tight">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      </div>
    )},
    { key: "role", header: "Role", cell: (r) => (
      <SelectInput
        value={r.role}
        onChange={(e) => onAssignRole(r, e.target.value)}
        className="h-8 w-40 text-xs"
      >
        {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
      </SelectInput>
    )},
    { key: "lastLogin", header: "Last login", cell: (r) => r.lastLogin },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <RowActions onEdit={() => { setEditing(r); setOpen(true); }} onDelete={() => setToDelete(r)} />
    )},
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Invite team members, assign roles, and control access."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Invite user
          </Button>
        }
      />
      <SectionCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-8"
            />
          </div>
          <SelectInput
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-44"
          >
            <option value="">All roles</option>
            {roles.map((r: RoleRow) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </SelectInput>
        </div>
        <DataTable columns={cols} rows={filtered} rowKey={(r) => r.id} empty="No users found." />
      </SectionCard>
      <UserForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Remove ${toDelete?.name}?`}
        description="The user will lose access immediately. This can be undone by re-inviting them."
        onConfirm={() => toDelete && onDelete(toDelete)}
      />
    </div>
  );
}
