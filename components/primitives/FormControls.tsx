import * as React from "react";
import { cn } from "@/lib/utils";

const baseInput =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInput, className)} {...props} />
  ),
);
TextInput.displayName = "TextInput";

export const NumberInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      className={cn(baseInput, "tabular-nums text-right", className)}
      {...props}
    />
  ),
);
NumberInput.displayName = "NumberInput";

export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(baseInput, "appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  ),
);
SelectInput.displayName = "SelectInput";

export const TextAreaInput = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseInput, "h-auto min-h-[80px] py-2", className)}
      {...props}
    />
  ),
);
TextAreaInput.displayName = "TextAreaInput";
