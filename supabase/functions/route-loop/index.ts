import { createClient } from 'npm:@supabase/supabase-js@2';

// route-loop — generate a walking loop of roughly X km from OSM footpath
// data around the user's position. Mirrors the pure algorithm in
// packages/training/src/route-loop.ts (keep in sync): Dijkstra out to a
// half-distance turnaround, route back with used edges penalized ×3.
// The achieved length is returned as-is; the client states it next to
// the request. Surfaces and closures are unverified and the note says so.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type Node = { id: number; lat: number; lng: number };

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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

function dijkstraHeap(
  adj: Map<number, { to: number; lengthM: number }[]>,
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
    for (const e of adj.get(u) ?? []) {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Not signed in.' }, 401);

  let lat = NaN;
  let lng = NaN;
  let km = NaN;
  try {
    const body = await req.json();
    lat = Number(body?.lat);
    lng = Number(body?.lng);
    km = Number(body?.km);
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!isFinite(lat) || !isFinite(lng) || !isFinite(km) || km < 1 || km > 15) {
    return json({ error: 'Send lat, lng and km between 1 and 15.' }, 400);
  }

  // Walkable ways within a radius sized to the loop; capped for Overpass's sake.
  const radius = Math.min(6000, Math.max(600, km * 450));
  const query = `[out:json][timeout:20];way(around:${radius},${lat},${lng})["highway"~"^(footway|path|pedestrian|track|cycleway|residential|living_street|steps)$"];(._;>;);out body;`;
  let elements: any[] = [];
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastStatus = 0;
  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Basalt-Health-App/0.1 (walking loop generation)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      lastStatus = res.status;
      if (!res.ok) continue;
      elements = (await res.json()).elements ?? [];
      break;
    } catch {
      lastStatus = -1;
    }
  }
  if (elements.length === 0 && lastStatus !== 200) {
    return json({ error: `OpenStreetMap's Overpass mirrors did not answer (last: ${lastStatus === -1 ? 'unreachable' : `HTTP ${lastStatus}`}) — try again shortly.` }, 502);
  }

  const nodes = new Map<number, Node>();
  const ways: number[][] = [];
  for (const el of elements) {
    if (el.type === 'node') nodes.set(el.id, { id: el.id, lat: el.lat, lng: el.lon });
    if (el.type === 'way' && Array.isArray(el.nodes)) ways.push(el.nodes);
  }
  const adj = new Map<number, { to: number; lengthM: number }[]>();
  const push = (a: number, b: number, lengthM: number) => {
    const list = adj.get(a) ?? [];
    list.push({ to: b, lengthM });
    adj.set(a, list);
  };
  for (const way of ways) {
    for (let i = 0; i + 1 < way.length; i++) {
      const a = nodes.get(way[i]);
      const b = nodes.get(way[i + 1]);
      if (!a || !b) continue;
      const d = haversineM(a, b);
      if (d <= 0) continue;
      push(a.id, b.id, d);
      push(b.id, a.id, d);
    }
  }
  if (nodes.size < 10) {
    return json({ error: 'Not enough mapped footpaths near you to build a loop.' }, 422);
  }

  let start: Node | null = null;
  let bestD = Infinity;
  for (const n of nodes.values()) {
    if (!adj.has(n.id)) continue;
    const d = haversineM({ lat, lng }, n);
    if (d < bestD) {
      bestD = d;
      start = n;
    }
  }
  if (!start) return json({ error: 'No walkable path found near you.' }, 422);

  const targetM = km * 1000;
  const out = dijkstraHeap(adj, start.id);
  let turn = -1;
  let bestGap = Infinity;
  for (const [id, d] of out.dist) {
    if (id === start.id) continue;
    const gap = Math.abs(d - targetM / 2);
    if (gap < bestGap) {
      bestGap = gap;
      turn = id;
    }
  }
  if (turn === -1) return json({ error: 'The path network near you is too small for that distance.' }, 422);
  const outPath = pathTo(out.prev, start.id, turn);
  const used = new Set<string>();
  for (let i = 0; i + 1 < outPath.length; i++) {
    const a = outPath[i];
    const b = outPath[i + 1];
    used.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  const back = dijkstraHeap(adj, turn, used);
  const backPath = pathTo(back.prev, turn, start.id);
  if (outPath.length < 2 || backPath.length < 2) {
    return json({ error: 'Could not close a loop on the mapped paths near you.' }, 422);
  }
  const ids = [...outPath, ...backPath.slice(1)];
  let lengthM = 0;
  const points = ids.map((id) => {
    const n = nodes.get(id)!;
    return { lat: n.lat, lng: n.lng };
  });
  for (let i = 0; i + 1 < points.length; i++) lengthM += haversineM(points[i], points[i + 1]);

  return json({
    points,
    lengthM: Math.round(lengthM),
    requestedM: targetM,
    note: 'From OpenStreetMap footpath data — surfaces, lighting and closures are unverified. © OpenStreetMap contributors.',
  });
});
