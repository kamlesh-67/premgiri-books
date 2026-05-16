// Stub — will be implemented in Phase 9 (RBAC & Admin)
interface RoleFormProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initial?: Record<string, unknown> | null
}
export function RoleForm({ open: _open, onOpenChange: _onOpenChange, initial: _initial }: RoleFormProps) {
  return <div>RoleForm placeholder</div>
}
