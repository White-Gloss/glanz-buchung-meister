import { Link } from "@tanstack/react-router";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, eur } from "@/lib/utils";

// Form und Verhalten stehen im Stylesheet (.btn), damit der Chrom-Verlauf und
// die Hover-Regeln an einer Stelle liegen. Aufrufstellen haengen weiterhin
// Utilities an — die gewinnen gegen die Komponenten-Ebene.
export const ctaPrimary = "btn btn-primary cta-shine";

export const ctaGhost = "btn btn-secondary";

/**
 * `tone` trennt die beiden Welten: "app" ist der bisherige Stil und gilt fuer
 * Admin, Login und die CMS-Werkzeuge, die vom Redesign ausgenommen sind.
 * "public" traegt die neue kantige Formensprache. Default ist bewusst "app",
 * damit die 25 App-Aufrufstellen unveraendert bleiben.
 */
export function Button({
  className,
  variant = "primary",
  tone = "app",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "line";
  tone?: "app" | "public";
}) {
  if (tone === "public") {
    const publicStyles = {
      primary: "btn-primary cta-shine",
      ghost: "btn-secondary",
      line: "border-transparent bg-transparent px-0 normal-case tracking-normal hover:underline underline-offset-4",
    } as const;
    return (
      <button
        className={cn("btn disabled:opacity-50", publicStyles[variant], className)}
        {...props}
      />
    );
  }

  const styles = {
    primary: "bg-accent text-accent-fg hover:bg-fg",
    ghost: "bg-transparent text-fg border border-line hover:bg-elevated",
    line: "bg-transparent text-fg underline-offset-4 hover:underline px-0",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out disabled:opacity-50 active:scale-[0.96]",
        styles[variant],
        className,
      )}
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
  tone = "app",
}: {
  id: string;
  label: string;
  children: ReactNode;
  tone?: "app" | "public";
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={
          tone === "public"
            ? "text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-muted"
            : "text-sm font-medium text-fg"
        }
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
