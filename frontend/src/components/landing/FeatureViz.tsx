import { MODULE_COLOR } from "../../lib/api";
import type { ModuleKey } from "../../lib/types";

function motif(module: ModuleKey, c: string) {
  switch (module) {
    case "curie": {
      const sats = [[58, 52], [262, 46], [60, 172], [258, 176], [160, 28]];
      return (
        <g>
          {sats.map(([x, y], i) => (
            <line key={i} x1={160} y1={112} x2={x} y2={y} stroke={c} strokeWidth={i < 2 ? 2.4 : 1.2} opacity={i < 2 ? 0.9 : 0.3} />
          ))}
          {sats.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={9} fill={c} opacity={i < 2 ? 0.95 : 0.45} />
          ))}
          <circle cx={160} cy={112} r={18} fill={c} opacity={0.25} />
          <circle cx={160} cy={112} r={11} fill={c}>
            <animate attributeName="r" values="11;14;11" dur="2.4s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
    case "medsync": {
      const xs = [48, 106, 164, 222, 280];
      return (
        <g>
          <line x1={40} y1={112} x2={288} y2={112} stroke={c} strokeWidth={2} opacity={0.35} />
          {xs.slice(0, -1).map((x, i) => (
            <path key={i} d={`M${x + 22},112 l8,-4 v8 z`} fill={c} opacity={0.5} />
          ))}
          {xs.map((x, i) => (
            <g key={i}>
              <circle cx={x} cy={112} r={i === 2 ? 12 : 8} fill={c} opacity={i === 2 ? 1 : 0.6}>
                {i === 2 && <animate attributeName="opacity" values="1;0.4;1" dur="2.2s" repeatCount="indefinite" />}
              </circle>
              <rect x={x - 16} y={i % 2 ? 134 : 74} width={32} height={6} rx={3} fill={c} opacity={0.28} />
            </g>
          ))}
        </g>
      );
    }
    case "rxshield":
      return (
        <g>
          <path
            d="M160,34 L232,64 L232,118 C232,166 198,188 160,200 C122,188 88,166 88,118 L88,64 Z"
            fill={c} fillOpacity={0.12} stroke={c} strokeWidth={2.2} strokeOpacity={0.8}
          />
          <circle cx={134} cy={112} r={13} fill={c} opacity={0.85} />
          <circle cx={186} cy={112} r={13} fill={c} opacity={0.85} />
          <line x1={147} y1={112} x2={173} y2={112} stroke={c} strokeWidth={2.4} />
          <path d="M160,90 l-7,22 h14 z" fill={c}>
            <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
          </path>
          <circle cx={160} cy={126} r={2.6} fill={c} />
        </g>
      );
    case "nutrisim": {
      const d = "M40,150 C80,150 90,90 130,90 C170,90 178,150 218,150 C250,150 258,104 288,104";
      return (
        <g>
          <path d={`${d} V196 H40 Z`} fill={c} fillOpacity={0.14} />
          <path d={d} fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
          <path d="M150,44 a34,34 0 1 1 -24,10" fill="none" stroke={c} strokeWidth={2.2} opacity={0.7} />
          <path d="M126,54 l4,-14 11,8 z" fill={c} opacity={0.7} />
          <circle cx={130} cy={90} r={6} fill={c}>
            <animate attributeName="r" values="6;9;6" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
    case "pathos": {
      const mood = "M40,150 C82,150 92,108 132,118 C172,128 182,96 222,104 C252,110 262,128 288,120";
      const anx = "M40,108 C82,108 92,150 132,140 C172,130 182,162 222,150 C252,141 262,118 288,128";
      return (
        <g>
          <path d={anx} fill="none" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="5 6" opacity={0.55} />
          <path d={mood} fill="none" stroke={c} strokeWidth={2.8} strokeLinecap="round" />
          <circle cx={132} cy={118} r={6} fill={c} />
          <circle cx={222} cy={104} r={6} fill={c}>
            <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
    case "neurograph": {
      const bars = [[58, 60], [108, 86], [158, 116], [208, 150], [258, 176]];
      const line = "M58,72 C108,86 158,128 208,158 C238,176 248,182 268,188";
      return (
        <g>
          {bars.map(([x, y], i) => (
            <rect key={i} x={x - 13} y={y} width={26} height={196 - y} rx={5} fill={c} opacity={0.7 - i * 0.11} />
          ))}
          <path d={line} fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="4 5" opacity={0.85} />
          <circle cx={268} cy={188} r={6} fill={c}>
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
  }
}

export default function FeatureViz({ module }: { module: ModuleKey }) {
  const c = MODULE_COLOR[module];
  return (
    <div className="glass relative aspect-[4/3] w-full overflow-hidden p-4">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(70% 70% at 50% 42%, ${c}26, transparent 72%)` }}
      />
      <svg viewBox="0 0 320 220" className="relative h-full w-full">
        {motif(module, c)}
      </svg>
    </div>
  );
}
