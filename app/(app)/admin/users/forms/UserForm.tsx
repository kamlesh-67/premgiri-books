// Stub — will be implemented in Phase 9 (RBAC & Admin)
interface UserFormProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initial?: Record<string, unknown> | null
}
export function UserForm({ open: _open, onOpenChange: _onOpenChange, initial: _initial }: UserFormProps) {
  return <div>UserForm placeholder</div>
}
