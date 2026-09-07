import { useId, useRef, useState } from "react";
import type { PublicFormErrors, PublicFormField } from "@/lib/public-form-validation";

/** Keep errors attached to their controls and move focus after React commits. */
export function usePublicFormErrors() {
  const [errors, setErrors] = useState<PublicFormErrors>({});
  const id = useId();
  const pendingFocus = useRef(false);

  function fieldProps(field: PublicFormField) {
    return {
      "aria-invalid": errors[field] ? (true as const) : undefined,
      "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined,
      onInput: () => {
        if (!errors[field]) return;
        setErrors((current) => ({ ...current, [field]: undefined }));
      },
    };
  }

  function showErrors(next: PublicFormErrors, form: HTMLFormElement) {
    setErrors(next);
    pendingFocus.current = true;
    window.requestAnimationFrame(() => {
      if (!pendingFocus.current || !form.isConnected) return;
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      pendingFocus.current = false;
    });
  }

  function fieldError(field: PublicFormField) {
    const message = errors[field];
    return message ? (
      <p id={`${id}-${field}-error`} className="text-sm text-danger">
        {message}
      </p>
    ) : null;
  }

  return { fieldProps, fieldError, showErrors };
}
