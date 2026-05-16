"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SectionCard } from "@/components/primitives/SectionCard";
import { ConfirmDelete } from "@/components/primitives/ConfirmDelete";
import { useCollection, remove, getCollection, type RoleRow } from "@/lib/mockStore";
import { RoleForm } from "./forms/RoleForm";

export default function Roles() {
  const roles = useCollection("roles");
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<RoleRow | null>(null);

  const onDelete = (r: RoleRow) => {
    const inUse = getCollection("users").some((u) => u.role === r.name);
    if (inUse) {
      toast.error(`Cannot delete ${r.name} — users are still assigned to it.`);
      setToDelete(null);
      return;
    }
    remove("roles", r.name);
    toast.success(`${r.name} removed`);
    setToDelete(null);
  };

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can see and do."
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />New role
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {roles.map((r) => (
          <SectionCard
            key={r.name}
            title={r.name}
            actions={
              <div className="flex items-center gap-1">
                <button
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => { setEditing(r); setOpen(true); }}
                  aria-label={`Edit ${r.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  onClick={() => setToDelete(r)}
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <UsersIcon className="h-4 w-4" />{r.users} {r.users === 1 ? "user" : "users"}
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module access</p>
            <div className="flex flex-wrap gap-1.5">
              {r.scopes.map((s) => (
                <span key={s} className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{s}</span>
              ))}
            </div>
          </SectionCard>
        ))}
        {roles.length === 0 && (
          <SectionCard><p className="text-sm text-muted-foreground">No roles defined yet.</p></SectionCard>
        )}
      </div>
      <RoleForm open={open} onOpenChange={setOpen} initial={editing} />
      <ConfirmDelete
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="Roles can only be removed when no users are assigned to them."
        onConfirm={() => toDelete && onDelete(toDelete)}
      />
    </div>
  );
}
