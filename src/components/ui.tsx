import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "bordeaux" | "gold" | "sage" | "ink" | "ghost";

const VARIANTS: Record<Variant, string> = {
  bordeaux:
    "bg-bordeaux text-paper-card hover:bg-bordeaux-soft border-bordeaux/40 shadow-sheet-sm",
  gold: "bg-gold text-ink hover:bg-gold-bright border-gold/40 shadow-sheet-sm",
  sage: "bg-sage text-paper-card hover:brightness-110 border-sage/40 shadow-sheet-sm",
  ink: "bg-ink text-paper-card hover:bg-ink-soft border-ink/40 shadow-sheet-sm",
  ghost:
    "bg-paper-card/70 text-ink-soft hover:bg-paper-card border-paper-edge hover:text-ink",
};

export function Btn({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`key-press inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-sans text-sm font-600 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card rounded-2xl ${className}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-xl border border-paper-edge bg-paper-deep/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-[10px] font-sans font-600 transition-all ${
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
          } ${
            value === o.id
              ? "bg-ink text-paper-card shadow-sheet-sm"
              : "text-ink-faint hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
