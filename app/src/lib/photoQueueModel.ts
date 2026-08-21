// Photo-now-log-later queue — the pure half (no RN imports, tested).
// Serialization is defensive: a corrupted store yields an empty queue,
// never a crash and never invented entries.

export type QueuedPhoto = { id: string; uri: string; takenAt: string };

export function queueList(json: string): QueuedPhoto[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is QueuedPhoto =>
        typeof q?.id === 'string' && typeof q?.uri === 'string' && typeof q?.takenAt === 'string',
    );
  } catch {
    return [];
  }
}

export function queueAdd(queue: QueuedPhoto[], entry: QueuedPhoto): QueuedPhoto[] {
  if (queue.some((q) => q.id === entry.id)) return queue;
  return [...queue, entry];
}

export function queueRemove(queue: QueuedPhoto[], id: string): QueuedPhoto[] {
  return queue.filter((q) => q.id !== id);
}

/** "Yesterday 19:42" style label without pulling in a date library. */
export function queuedLabel(takenAtIso: string, now: Date): string {
  const taken = new Date(takenAtIso);
  const time = `${String(taken.getHours()).padStart(2, '0')}:${String(taken.getMinutes()).padStart(2, '0')}`;
  const dayMs = 86_400_000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(taken)) / dayMs);
  if (diffDays <= 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${taken.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}
