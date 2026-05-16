"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { useUiStore } from "@/lib/stores/uiStore";
import { JournalForm } from "../forms/JournalForm";

export default function JournalNew() {
  const router = useRouter();
  const { uiMode } = useUiStore();

  // Journal Entry is Advanced Mode only — redirect Simple Mode users
  useEffect(() => {
    if (uiMode === "simple") {
      router.replace("/dashboard");
    }
  }, [uiMode, router]);

  if (uiMode === "simple") return null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="New Journal Entry"
        subtitle="Manual accounting adjustment — debit and credit any ledger accounts"
        action={
          <Button variant="outline" onClick={() => router.push("/journal")}>
            Cancel
          </Button>
        }
      />
      <SectionCard title="Journal Entry">
        <JournalForm onSuccess={(id) => router.push(`/journal${id ? `/${id}` : ""}`)} />
      </SectionCard>
    </div>
  );
}
