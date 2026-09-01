import { Link } from "@tanstack/react-router";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, eur } from "@/lib/utils";

// Form und Verhalten stehen im Stylesheet (.btn), damit der Chrom-Verlauf und
// die Hover-Regeln an einer Stelle liegen. Aufrufstellen haengen weiterhin
// Utilities an — die gewinnen gegen die Komponenten-Ebene.
export const ctaPrimary = "btn btn-primary cta-shine";

export const ctaGhost = "btn btn-secondary";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "line";
}) {
  const styles = {
    primary: "btn-primary cta-shine",
    ghost: "btn-secondary",
    line: "border-transparent bg-transparent px-0 text-fg normal-case tracking-normal hover:underline underline-offset-4",
  } as const;
  return (
    <button
      className={cn("btn disabled:opacity-50", styles[variant], className)}
      {...props}
    />
  );
}

export function TextLink({
  to,
  children,
  className,
  hash,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  hash?: string;
}) {
  return (
    <Link
      to={to}
      hash={hash}
      className={cn(
        "text-sm font-medium text-fg underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function PriceLine({
  name,
  hint,
  price,
  note,
}: {
  name: string;
  hint?: string;
  price: number;
  note?: string;
}) {
  return (
    <li className="py-4">
      <div className="flex items-baseline gap-3">
        <span className="shrink-0 text-fg">{name}</span>
        <span
          className="min-w-6 flex-1 border-b border-dotted border-line"
          aria-hidden
        />
        <span className="shrink-0 tabular-nums text-fg">
          <span className="mr-1 text-xs tracking-[0.14em] text-subtle">ab</span>
          {eur(price)}
        </span>
      </div>
      {hint ? <p className="mt-1 max-w-xl text-sm text-muted">{hint}</p> : null}
      {note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
    </li>
  );
}

/** Oeffentliche Formulare: transparent mit unterer Haarlinie. */
export const inputLine = "input-line";

/** Admin-Bereich: kastenfoermig, bleibt unveraendert. */
export const inputClass =
  "min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle transition-[border-color,box-shadow] duration-200 focus:border-accent focus:outline-none focus:shadow-[0_0_0_1px_var(--color-accent)]";
