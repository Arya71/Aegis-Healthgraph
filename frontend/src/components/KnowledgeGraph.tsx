import {
  Background, BackgroundVariant, Controls, Handle, Position, ReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import { useMemo, useState } from "react";
import { MODULE_COLOR, MODULES } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import type { Graph, GraphNode, ModuleKey } from "../lib/types";

const LANES: ModuleKey[] = ["curie", "medsync", "rxshield", "nutrisim", "pathos", "neurograph"];
const NODE_W = 158;
const H_GAP = 28; // min horizontal gap before a node drops to a new sub-row
const ROW_H = 54; // vertical spacing between sub-rows within a lane
const LANE_PAD = 26; // gap between lanes
const TOP = 46;
const LEFT = 164; // room for lane labels at x≈0
const SPAN = 1160; // timeline width; height grows as lanes need sub-rows

const PALETTE = {
  dark: {
    nodeText: "#eef2ff", dimBg: "rgba(255,255,255,0.03)", dimBorder: "rgba(255,255,255,0.08)",
    dot: "rgba(255,255,255,0.06)", labelFill: "#cdd6f4", labelBg: "#0b1022", laneText: "#ffffff",
  },
  light: {
    nodeText: "#0f172a", dimBg: "rgba(15,23,42,0.04)", dimBorder: "rgba(15,23,42,0.12)",
    dot: "rgba(15,23,42,0.08)", labelFill: "#334155", labelBg: "#ffffff", laneText: "#0f172a",
  },
};

const LANE_PREFIX = "__lane__";
const timeOf = (d: string | null, fallback: number) => (d ? new Date(d).getTime() : fallback);

interface LayoutResult {
  pos: Record<string, { x: number; y: number }>;
  laneRows: { lane: ModuleKey; y: number }[];
}

/**
 * Swimlane × timeline layout with vertical sub-row packing.
 * x is fixed by date (so the graph stays ~SPAN wide and reads as a timeline);
 * within each module lane, nodes that would overlap in time are stacked into
 * sub-rows via greedy interval packing — so nothing ever overlaps and the graph
 * grows in height (not width) where a period is busy. Empty lanes are skipped.
 */
function layout(g: Graph): LayoutResult {
  const laneList = LANES.filter((l) => g.nodes.some((n) => n.module === l));
  const times = g.nodes.filter((n) => n.date).map((n) => timeOf(n.date, 0));
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : min + 1;
  const xFor = (t: number) => LEFT + ((t - min) / (max - min || 1)) * SPAN;
  const DATELESS_X = LEFT + SPAN + 56; // concept "hub" nodes sit past the timeline

  const pos: Record<string, { x: number; y: number }> = {};
  const laneRows: { lane: ModuleKey; y: number }[] = [];
  let cursorY = TOP;

  for (const lane of laneList) {
    const laneNodes = g.nodes
      .filter((n) => n.module === lane)
      .map((n) => ({ n, x: n.date ? xFor(timeOf(n.date, max)) : DATELESS_X }))
      .sort((a, b) => a.x - b.x || a.n.id.localeCompare(b.n.id));

    const rowRightEdge: number[] = []; // last occupied x per sub-row
    laneRows.push({ lane, y: cursorY });
    for (const { n, x } of laneNodes) {
      let row = rowRightEdge.findIndex((edge) => edge + H_GAP <= x);
      if (row === -1) {
        row = rowRightEdge.length;
        rowRightEdge.push(0);
      }
      rowRightEdge[row] = x + NODE_W;
      pos[n.id] = { x, y: cursorY + row * ROW_H };
    }
    cursorY += Math.max(1, rowRightEdge.length) * ROW_H + LANE_PAD;
  }
  return { pos, laneRows };
}

function AegisNode({ data }: NodeProps) {
  const d = data as unknown as {
    label: string; module: ModuleKey; dim: boolean; pulse: boolean; weight: number;
  };
  const color = MODULE_COLOR[d.module] ?? "#8b6cff";
  const { theme } = useTheme();
  const pal = PALETTE[theme];
  return (
    <div
      className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold leading-tight backdrop-blur-md transition-all duration-300 ${
        d.pulse ? "animate-pulseRing" : ""
      }`}
      style={{
        width: NODE_W,
        color: pal.nodeText,
        background: d.dim ? pal.dimBg : `${color}22`,
        borderColor: d.dim ? pal.dimBorder : `${color}aa`,
        opacity: d.dim ? 0.34 : 1,
        boxShadow: d.dim ? "none" : `0 0 ${10 + d.weight * 12}px -4px ${color}`,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="line-clamp-2">
        <span className="mr-1" style={{ color }}>●</span>
        {d.label}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

function LaneNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; color: string; icon: string };
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
      style={{ color: d.color, background: `${d.color}14`, border: `1px solid ${d.color}33` }}
    >
      <span>{d.icon}</span>
      {d.label}
    </div>
  );
}

const nodeTypes = { aegis: AegisNode, lane: LaneNode };

export default function KnowledgeGraph({
  graph, height = 540, highlight = [], onSelect, hiddenModules, showLaneLabels = true,
}: {
  graph: Graph;
  height?: number;
  highlight?: string[];
  onSelect?: (node: GraphNode) => void;
  hiddenModules?: Set<ModuleKey>;
  showLaneLabels?: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { theme } = useTheme();
  const pal = PALETTE[theme];

  // Apply module visibility filter
  const visible = useMemo<Graph>(() => {
    if (!hiddenModules || hiddenModules.size === 0) return graph;
    const nodes = graph.nodes.filter((n) => !hiddenModules.has(n.module));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [graph, hiddenModules]);

  const { pos, laneRows } = useMemo(() => layout(visible), [visible]);
  const moduleOf = useMemo(() => {
    const m: Record<string, ModuleKey> = {};
    visible.nodes.forEach((n) => (m[n.id] = n.module));
    return m;
  }, [visible]);

  const neighbors = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    for (const e of visible.edges) {
      if (e.source === hover) set.add(e.target);
      if (e.target === hover) set.add(e.source);
    }
    return set;
  }, [hover, visible.edges]);

  const hi = useMemo(() => new Set(highlight), [highlight]);

  const realNodes: Node[] = visible.nodes.map((n) => ({
    id: n.id,
    type: "aegis",
    position: pos[n.id] ?? { x: 0, y: 0 },
    data: {
      label: n.label, module: n.module, weight: n.weight,
      dim: (neighbors && !neighbors.has(n.id)) || (hi.size > 0 && !hi.has(n.id) && !hover),
      pulse: hi.has(n.id),
    },
  }));

  const laneNodes: Node[] = showLaneLabels
    ? laneRows.map(({ lane, y }) => {
        const meta = MODULES.find((m) => m.key === lane)!;
        return {
          id: `${LANE_PREFIX}${lane}`,
          type: "lane",
          position: { x: 0, y: y + 6 },
          draggable: false, selectable: false,
          data: { label: meta.name, color: MODULE_COLOR[lane], icon: meta.icon },
        };
      })
    : [];

  const nodes = [...laneNodes, ...realNodes];

  const edges: Edge[] = visible.edges.map((e) => {
    const active = !neighbors || (neighbors.has(e.source) && neighbors.has(e.target));
    const onPath = hi.has(e.source) && hi.has(e.target);
    const cross = moduleOf[e.source] !== moduleOf[e.target]; // cross-specialty link
    const srcColor = MODULE_COLOR[moduleOf[e.source] ?? "curie"];
    const stroke = onPath ? "#ff5fa2" : cross ? "#ff9ecb" : srcColor;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: active && hover ? e.relation : undefined,
      animated: active && (onPath || !!hover || cross),
      style: {
        stroke,
        strokeWidth: onPath ? 2.6 : cross ? 2 : 1.3,
        opacity: active ? (onPath ? 1 : cross ? 0.85 : 0.4) : 0.07,
      },
      labelStyle: { fill: pal.labelFill, fontSize: 10 },
      labelBgStyle: { fill: pal.labelBg, fillOpacity: 0.85 },
    };
  });

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-line/10 bg-field/20">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        onNodeMouseEnter={(_, n) => !n.id.startsWith(LANE_PREFIX) && setHover(n.id)}
        onNodeMouseLeave={() => setHover(null)}
        onNodeClick={(_, n) => {
          if (n.id.startsWith(LANE_PREFIX)) return;
          const gn = visible.nodes.find((x) => x.id === n.id);
          if (gn) onSelect?.(gn);
        }}
        nodesDraggable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color={pal.dot} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
