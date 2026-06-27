import { motion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function GlassCard({
  children, className = "", hover = false, delay = 0, style,
}: { children: ReactNode; className?: string; hover?: boolean; delay?: number; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`glass ${hover ? "glass-hover" : ""} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        {kicker && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-fg/40">{kicker}</div>}
        <h2 className="text-xl font-bold text-fg">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function ConfidenceMeter({ value, color = "#8b6cff" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-surface/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, #ff9ecb)` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

export function Typewriter({ text, speed = 14, className = "" }: { text: string; speed?: number; className?: string }) {
  const [shown, setShown] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    setShown("");
    idx.current = 0;
    const t = setInterval(() => {
      idx.current += 1;
      setShown(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  const done = shown.length >= text.length;
  return <span className={`${className} ${done ? "" : "typing-caret"}`}>{shown}</span>;
}

export function Pill({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  const base = color ? { color, borderColor: `${color}55`, background: `${color}1a` } : {};
  return (
    <span className="chip" style={{ ...base, ...style }}>
      {children}
    </span>
  );
}

export function StatPill({
  label, value, color = "#9ec3ff", style,
}: { label: string; value: string; color?: string; style?: CSSProperties }) {
  return (
    <div className="glass px-4 py-3" style={style}>
      <div className="text-[11px] uppercase tracking-wider text-fg/40">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export function Spinner({ label = "Loading memory…" }: { label?: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-fg/50">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-line/15 border-t-[#8b6cff]" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
