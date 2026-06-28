import { useState, type CSSProperties, type ReactNode } from "react";

export default function AsyncButton({
  onClick, children, runningLabel = "Working…", className = "btn-primary", disabled, style,
}: {
  onClick: () => Promise<unknown> | unknown;
  children: ReactNode;
  runningLabel?: string;
  className?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={className} style={style} disabled={busy || disabled} onClick={run}>
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
          {runningLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
