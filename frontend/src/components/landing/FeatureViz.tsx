/**
 * FeatureViz.tsx — updated to add omnigest SVG motif.
 * Replace frontend/src/components/landing/FeatureViz.tsx with this file.
 * Only change: added "omnigest" case to the motif() switch + default fallback.
 */
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
      const anx  = "M40,108 C82,108 92,150 132,140 C172,130 182,162 222,150 C252,141 262,118 288,128";
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

    // ── NEW: OmniGest — animated data-stream ingestion diagram ──────────────
    case "omnigest": {
      // left: document icon; right: graph nodes; animated data-stream particles
      const nodes = [[220, 68], [262, 112], [220, 156], [270, 170], [240, 52]];
      return (
        <g>
          {/* document rectangle */}
          <rect x={44} y={60} width={80} height={104} rx={8} fill={c} fillOpacity={0.12} stroke={c} strokeWidth={2} strokeOpacity={0.7} />
          {/* page lines */}
          {[80, 94, 108, 122].map((y) => (
            <rect key={y} x={56} y={y} width={56} height={4} rx={2} fill={c} opacity={0.35} />
          ))}
          {/* Gemini "G" symbol hint */}
          <circle cx={84} cy={68} r={10} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.5} />
          <text x={84} y={72} textAnchor="middle" fontSize={10} fill={c} fontWeight="bold" opacity={0.9}>G</text>

          {/* stream path */}
          <path d="M124,112 C152,112 164,90 180,80" fill="none" stroke={c} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />
          <path d="M124,112 C152,112 164,112 180,112" fill="none" stroke={c} strokeWidth={2} strokeDasharray="5 3" opacity={0.6} />
          <path d="M124,112 C152,112 164,134 180,144" fill="none" stroke={c} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />

          {/* animated particle on main stream */}
          <circle r={5} fill={c} opacity={0.9}>
            <animateMotion dur="1.8s" repeatCount="indefinite"
              path="M124,112 C152,112 164,112 220,112" />
          </circle>
          <circle r={3.5} fill={c} opacity={0.6}>
            <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.4s"
              path="M124,112 C152,112 164,90 220,68" />
          </circle>
          <circle r={3.5} fill={c} opacity={0.6}>
            <animateMotion dur="2.4s" repeatCount="indefinite" begin="0.9s"
              path="M124,112 C152,112 164,134 220,156" />
          </circle>

          {/* graph nodes on the right */}
          {nodes.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={i === 1 ? 13 : 9} fill={c} opacity={i === 1 ? 1 : 0.65}>
                {i === 1 && <animate attributeName="r" values="13;16;13" dur="2s" repeatCount="indefinite" />}
              </circle>
            </g>
          ))}
          {/* edges between graph nodes */}
          {[[0,1],[1,2],[1,4],[2,3]].map(([a, b], i) => (
            <line key={i}
              x1={nodes[a][0]} y1={nodes[a][1]}
              x2={nodes[b][0]} y2={nodes[b][1]}
              stroke={c} strokeWidth={1.6} opacity={0.45}
            />
          ))}
        </g>
      );
    }

    // ── NEW: HealthForecast — trajectory diverging from baseline into a forecast cone ──
    case "healthforecast": {
      const GREEN = "#37d6b3";
      const baselineD = "M40,150 C100,144 160,140 220,136 C250,134 270,132 288,130";
      const patientD = "M40,150 C100,146 150,128 190,106 C220,88 250,72 280,52";
      return (
        <g>
          {/* forecast cone — widening uncertainty band around the patient curve */}
          <path
            d="M190,106 C220,88 250,72 280,52 L280,76 C250,92 222,106 196,122 Z"
            fill={c} fillOpacity={0.14}
          />
          {/* baseline (healthy aging) — dashed green */}
          <path d={baselineD} fill="none" stroke={GREEN} strokeWidth={2} strokeDasharray="5 5" opacity={0.8} />
          {/* patient trajectory — solid orange, diverging upward (risk) */}
          <path d={patientD} fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
          {/* divergence markers at year 3 and year 5 */}
          <line x1={190} y1={106} x2={190} y2={140} stroke={c} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <line x1={280} y1={52} x2={280} y2={130} stroke={c} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          {/* data point on patient curve, pulsing — "you are here" */}
          <circle cx={140} cy={132} r={6} fill={c}>
            <animate attributeName="r" values="6;9;6" dur="2.2s" repeatCount="indefinite" />
          </circle>
          {/* forecast endpoint */}
          <circle cx={280} cy={52} r={5} fill={c} opacity={0.85} />
          <circle cx={288} cy={130} r={4} fill={GREEN} opacity={0.85} />
          {/* axis hint */}
          <line x1={40} y1={196} x2={288} y2={196} stroke={c} strokeWidth={1} opacity={0.2} />
          <text x={42} y={210} fontSize={9} fill={c} opacity={0.55}>now</text>
          <text x={266} y={210} fontSize={9} fill={c} opacity={0.55}>5yr</text>
        </g>
      );
    }

    default:
      // Safety fallback — renders a generic pulsing circle for any unknown module
      return (
        <g>
          <circle cx={160} cy={112} r={40} fill={c} opacity={0.2}>
            <animate attributeName="r" values="40;50;40" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={160} cy={112} r={20} fill={c} opacity={0.7} />
        </g>
      );
  }
}

export default function FeatureViz({ module }: { module: ModuleKey }) {
  const c = MODULE_COLOR[module] ?? "#8b6cff";
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
