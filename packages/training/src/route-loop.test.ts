import { describe, it, expect } from 'vitest';
import { buildGraph, generateLoop, nearestNode, type LoopNode } from './route-loop';
import { clusterRoutes, usualLoop, routeSimilarityM, ROUTE_MATCH } from './route-match';
import type { RoutePt } from './route-map';

// 5×5 street grid, ~110 m spacing (0.001°), fully connected.
function gridGraph() {
  const nodes: LoopNode[] = [];
  const ways: number[][] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      nodes.push({ id: r * 5 + c, lat: -33.87 + r * 0.001, lng: 151.2 + c * 0.001 });
    }
  }
  for (let r = 0; r < 5; r++) ways.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) ways.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  return buildGraph(nodes, ways);
}

describe('generateLoop', () => {
  it('returns a loop that starts and ends at the start node', () => {
    const g = gridGraph();
    const loop = generateLoop(g, 0, 800)!;
    expect(loop.nodeIds[0]).toBe(0);
    expect(loop.nodeIds[loop.nodeIds.length - 1]).toBe(0);
  });

  it("achieved length is in the target's neighbourhood and reported honestly", () => {
    const g = gridGraph();
    const loop = generateLoop(g, 0, 800)!;
    expect(loop.lengthM).toBeGreaterThan(500);
    expect(loop.lengthM).toBeLessThan(1300);
  });

  it('the return leg differs from the way out (edge-penalty works)', () => {
    const g = gridGraph();
    const loop = generateLoop(g, 0, 800)!;
    const edges = new Set<string>();
    let reused = 0;
    for (let i = 0; i + 1 < loop.nodeIds.length; i++) {
      const a = loop.nodeIds[i]!;
      const b = loop.nodeIds[i + 1]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (edges.has(key)) reused++;
      edges.add(key);
    }
    expect(reused).toBeLessThan(edges.size / 2); // mostly fresh ground
  });

  it('an empty graph yields null, not a phantom route', () => {
    const g = buildGraph([], []);
    expect(generateLoop(g, 0, 1000)).toBeNull();
  });

  it('nearestNode snaps to the closest graph node', () => {
    const g = gridGraph();
    expect(nearestNode(g, -33.8701, 151.2001)!.id).toBe(0);
  });
});

describe('matched routes', () => {
  const loopA: RoutePt[] = Array.from({ length: 20 }, (_, i) => ({
    lat: -33.87 + 0.002 * Math.sin((i / 19) * 2 * Math.PI),
    lng: 151.2 + 0.002 * Math.cos((i / 19) * 2 * Math.PI),
  }));
  const loopAJittered = loopA.map((p) => ({ lat: p.lat + 0.0002, lng: p.lng }));
  const loopFar = loopA.map((p) => ({ lat: p.lat + 0.05, lng: p.lng }));

  it('the same loop with GPS jitter matches; a distant loop does not', () => {
    expect(routeSimilarityM(loopA, loopAJittered)).toBeLessThan(ROUTE_MATCH.thresholdM);
    expect(routeSimilarityM(loopA, loopFar)).toBeGreaterThan(ROUTE_MATCH.thresholdM);
  });

  it('direction-agnostic: the loop walked backwards still matches', () => {
    expect(routeSimilarityM(loopA, [...loopA].reverse())).toBeLessThan(ROUTE_MATCH.thresholdM);
  });

  it('usualLoop needs 3+ walks and reports the median time', () => {
    const walks = [
      { id: 'a', route: loopA, durationS: 1800 },
      { id: 'b', route: loopAJittered, durationS: 1900 },
      { id: 'c', route: loopA, durationS: 2000 },
      { id: 'd', route: loopFar, durationS: 999 },
    ];
    const usual = usualLoop(walks)!;
    expect(usual.walkIds).toEqual(['a', 'b', 'c']);
    expect(usual.medianDurationS).toBe(1900);
    expect(usualLoop(walks.slice(0, 2))).toBeNull();
  });

  it('routeless walks are skipped, never fabricated into clusters', () => {
    expect(clusterRoutes([{ id: 'x', route: null, durationS: 100 }])).toEqual([]);
  });
});
