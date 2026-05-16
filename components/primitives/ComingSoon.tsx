import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
}

export function ComingSoon({ title, subtitle }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle ?? "This module is part of the upcoming build phase."} />
      <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The design and data model for this page is documented. It will be implemented in a follow-up phase.
        </p>
      </div>
    </div>
  );
}
