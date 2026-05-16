// Phase 1 stub — shows plain-language contextual help for non-accountant users
// Full logic (context-aware messages per screen) implemented in Phase 1 (UX-04)
interface BusinessLanguageAlertProps {
  message: string
  variant?: 'info' | 'warning' | 'success'
}

export function BusinessLanguageAlert({ message, variant = 'info' }: BusinessLanguageAlertProps) {
  const colors = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  }
  return (
    <div className={`rounded-lg border p-3 text-sm ${colors[variant]}`}>
      {message}
    </div>
  )
}
