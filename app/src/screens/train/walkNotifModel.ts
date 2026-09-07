import { mmss } from '@basalt/ui/src/format';

// The walk's lock-screen notification — the pure half. Distance, pace and
// elapsed in one line; paused states say so. Pace only renders once there
// is 100 m of signal (a 3-second pace over 8 m would be noise theatre).

export function walkDistanceText(distM: number): string {
  return distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(2)} km`;
}

export function walkPaceText(distM: number, movingS: number): string | null {
  if (distM < 100 || movingS <= 0) return null;
  const secPerKm = movingS / (distM / 1000);
  if (!isFinite(secPerKm) || secPerKm > 3600) return null;
  return `${mmss(Math.round(secPerKm))} /km`;
}

export function walkNotifText(input: { distM: number; movingS: number; paused: boolean }): {
  title: string;
  body: string;
} {
  const bits = [walkDistanceText(input.distM)];
  const pace = walkPaceText(input.distM, input.movingS);
  if (pace) bits.push(pace);
  bits.push(mmss(Math.max(0, Math.round(input.movingS))));
  return {
    title: input.paused ? 'Basalt — walk paused' : 'Basalt — recording your walk',
    body: (input.paused ? 'Paused · ' : '') + bits.join(' · '),
  };
}
