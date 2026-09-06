import { useEffect, useRef, type ReactNode } from "react";

export function SubmissionResult({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p ref={ref} tabIndex={-1} className={className}>
      {children}
    </p>
  );
}
