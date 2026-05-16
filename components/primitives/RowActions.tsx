import { Eye, Pencil, Trash2 } from "lucide-react";

interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RowActions({ onView, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1 text-muted-foreground">
      {onView && (
        <button type="button" className="rounded-md p-1.5 hover:bg-muted hover:text-foreground" onClick={onView} aria-label="View">
          <Eye className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button type="button" className="rounded-md p-1.5 hover:bg-muted hover:text-foreground" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button type="button" className="rounded-md p-1.5 hover:bg-muted hover:text-destructive" onClick={onDelete} aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
