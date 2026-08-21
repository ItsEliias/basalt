import { haversineM } from './gps';

// Loop generation over an OSM footpath graph — the pure algorithm. The
// Edge Function mirrors this exactly (Deno can't import the workspace;
// keep them in sync). Method, in words: Dijkstra out from the start to
// find a turnaround node whose distance is closest to half the requested
// length, then route back with used edges penalized ×3 so the return leg
// prefers different paths. The achieved length is reported as-is — the
// UI states it next to the request, never rounds it into agreement.

export type LoopNode = { id: number; lat: number; lng: number };

export type LoopGraph = {
  nodes: Map<number, LoopNode>;
  /** adjacency: nodeId → [{to, lengthM}] */
  adj: Map<number, { to: number; lengthM: number }[]>;
};

export function buildGraph(nodes: LoopNode[], ways: number[][]): LoopGraph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<number, { to: number; lengthM: number }[]>();
  const push = (a: number, b: number, lengthM: number) => {
    const list = adj.get(a) ?? [];
    list.push({ to: b, lengthM });
    adj.set(a, list);
  };
  for (const way of ways) {
    for (let i = 0; i + 1 < way.length; i++) {
      const a = nodeMap.get(way[i]!);
      const b = nodeMap.get(way[i + 1]!);
      if (!a || !b) continue;
      const d = haversineM(a, b);
      if (d <= 0) continue;
      push(a.id, b.id, d);
      push(b.id, a.id, d);
    }
  }
  return { nodes: nodeMap, adj };
}


// Array binary min-heap of [dist, nodeId] — Dijkstra at city density
// needs O(E log V); linear selection melts an edge worker's CPU cap.
class MinHeap {
  private a: [number, number][] = [];
  get size() { return this.a.length; }
  push(item: [number, number]) {
    this.a.push(item);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p]![0] <= this.a[i]![0]) break;
      [this.a[p], this.a[i]] = [this.a[i]!, this.a[p]!];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length > 0 && last) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l]![0] < this.a[m]![0]) m = l;
        if (r < this.a.length && this.a[r]![0] < this.a[m]![0]) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i]!, this.a[m]!];
        i = m;
      }
    }
    return top;
  }
}

function dijkstra(
  graph: LoopGraph,
  start: number,
  penalized?: Set<string>,
) {
  const dist = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  const heap = new MinHeap();
  heap.push([0, start]);
  while (heap.size > 0) {
    const [d, u] = heap.pop()!;
    if (done.has(u)) continue;
    done.add(u);
    for (const e of graph.adj.get(u) ?? []) {
      const key = u < e.to ? `${u}-${e.to}` : `${e.to}-${u}`;
      const w = penalized?.has(key) ? e.lengthM * 3 : e.lengthM;
      const nd = d + w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        heap.push([nd, e.to]);
      }
    }
  }
  return { dist, prev };
}

function pathTo(prev: Map<number, number>, start: number, end: number): number[] {
  const path = [end];
  let cur = end;
  while (cur !== start) {
    const p = prev.get(cur);
    if (p === undefined) return [];
    path.push(p);
    cur = p;
  }
  return path.reverse();
}

export function nearestNode(graph: LoopGraph, lat: number, lng: number): LoopNode | null {
  let best: LoopNode | null = null;
  let bestD = Infinity;
  for (const n of graph.nodes.values()) {
    const d = haversineM({ lat, lng }, n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function generateLoop(
  graph: LoopGraph,
  startId: number,
  targetM: number,
): { nodeIds: number[]; lengthM: number } | null {
  const out = dijkstra(graph, startId);
  // turnaround: reachable node with real distance closest to target/2
  let turn = -1;
  let bestGap = Infinity;
  for (const [id, d] of out.dist) {
    if (id === startId) continue;
    const gap = Math.abs(d - targetM / 2);
    if (gap < bestGap) {
      bestGap = gap;
      turn = id;
    }
  }
  if (turn === -1) return null;
  const outPath = pathTo(out.prev, startId, turn);
  if (outPath.length < 2) return null;

  const used = new Set<string>();
  for (let i = 0; i + 1 < outPath.length; i++) {
    const a = outPath[i]!;
    const b = outPath[i + 1]!;
    used.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  const back = dijkstra(graph, turn, used);
  const backPath = pathTo(back.prev, turn, startId);
  if (backPath.length < 2) return null;

  const nodeIds = [...outPath, ...backPath.slice(1)];
  let lengthM = 0;
  for (let i = 0; i + 1 < nodeIds.length; i++) {
    const a = graph.nodes.get(nodeIds[i]!)!;
    const b = graph.nodes.get(nodeIds[i + 1]!)!;
    lengthM += haversineM(a, b);
  }
  return { nodeIds, lengthM: Math.round(lengthM) };
}
