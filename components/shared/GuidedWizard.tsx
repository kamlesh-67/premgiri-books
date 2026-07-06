"use client";

import React, { type ReactNode, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WizardStep {
  id: string;
  label: string;
  component: ReactNode;
  /** Optional per-step validation. Return true if step data is valid. */
  onValidate?: () => Promise<boolean>;
}

export interface GuidedWizardProps {
  steps: WizardStep[];
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  title?: string;
  /** Notifies the parent when the active step changes — e.g. to widen the page container on a wider step. */
  onStepChange?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// GuidedWizard component
// ---------------------------------------------------------------------------

export function GuidedWizard({ steps, onComplete, onCancel, title, onStepChange }: GuidedWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLastStep = currentStep === steps.length - 1;

  function goToStep(index: number) {
    setCurrentStep(index);
    onStepChange?.(index);
  }

  // Move to next step — validate current step first if a validator is provided.
  const handleNext = async () => {
    const step = steps[currentStep];
    if (step.onValidate) {
      const valid = await step.onValidate();
      if (!valid) return;
    }
    goToStep(currentStep + 1);
  };

  // Fire onComplete from the final step — form data is owned by the consumer.
  const handleComplete = async () => {
    const step = steps[currentStep];
    if (step.onValidate) {
      const valid = await step.onValidate();
      if (!valid) return;
    }
    setIsSubmitting(true);
    try {
      await onComplete({});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Optional title */}
      {title && (
        <h2 className="mb-4 sm:mb-6 text-lg sm:text-xl font-semibold text-gray-900">{title}</h2>
      )}

      {/* ── Progress indicator ─────────────────────────────────────────────── */}
      <div className="flex items-center mb-6 sm:mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold",
                  index < currentStep
                    ? "bg-purple-100 text-purple-600" // completed
                    : index === currentStep
                    ? "bg-purple-600 text-white"      // active
                    : "bg-gray-100 text-gray-400"     // pending
                )}
              >
                {index < currentStep ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[10px] sm:text-xs text-center whitespace-nowrap",
                  index === currentStep
                    ? "font-semibold text-purple-600"
                    : "text-gray-400"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mb-4 sm:mb-5 min-w-[16px]",
                  index < currentStep ? "bg-purple-600" : "bg-gray-200"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step content ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6 space-y-4 overflow-x-auto">
        {steps[currentStep].component}
      </div>

      {/* ── Navigation buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-6">
        {/* Left: Back button (hidden on step 0) */}
        <div>
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => goToStep(currentStep - 1)}
              type="button"
              className="w-full sm:w-auto"
            >
              ← Back
            </Button>
          )}
        </div>

        {/* Right: Cancel + Next/Create */}
        <div className="flex gap-3">
          {onCancel && currentStep === 0 && (
            <Button variant="ghost" onClick={onCancel} type="button" className="flex-1 sm:flex-none">
              Cancel
            </Button>
          )}

          {!isLastStep ? (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white flex-1 sm:flex-none"
              onClick={handleNext}
              type="button"
            >
              Next: {steps[currentStep + 1].label} →
            </Button>
          ) : (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white flex-1 sm:flex-none"
              onClick={handleComplete}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
