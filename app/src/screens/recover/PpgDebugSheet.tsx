import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';
import {
  CTA, SrcNote, ReceiptHeader, ReceiptRow, ObInput, EmptyState,
  color, mono, ScaledText as Text,
} from '@basalt/ui';
import { analyzePpg, PPG_RULES, type PpgResult, type PpgSample } from '@basalt/analytics';
import { supabase } from '../../lib/supabase';

// Camera-PPG debug screen (V3.1 H1) — the tuning bench, not the product.
// Raw waveform + detected peaks + every quality metric, and a calibration
// log where a simultaneous watch reading sits beside the camera's so the
// two can be compared on this exact hardware. The real capture card ships
// only after this table says the numbers agree; until then this screen is
// where honesty gets earned. Dev builds only (__DEV__); post-tuning it
// moves behind a Settings dev flag.

let VC: any = null;
let Worklets: any = null;
try {
  VC = require('react-native-vision-camera');
  Worklets = require('react-native-worklets-core').Worklets;
} catch {
  VC = null;
}

type CalRow = {
  id: string;
  takenAt: string;
  cameraRmssd: number | null;
  cameraBpm: number | null;
  watchRmssd: number | null;
  quality: any;
};

export function PpgDebugSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'idle' | 'capturing' | 'done'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [liveTail, setLiveTail] = useState<PpgSample[]>([]);
  const [result, setResult] = useState<PpgResult | null>(null);
  const [watchText, setWatchText] = useState('');
  const [rows, setRows] = useState<CalRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const samplesRef = useRef<PpgSample[]>([]);

  const loadRows = useCallback(() => {
    void supabase
      .from('basalt_ppg_calibration')
      .select('id, taken_at, camera_rmssd, camera_bpm, watch_rmssd, quality')
      .order('taken_at', { ascending: false })
      .limit(12)
      .then(({ data }) =>
        setRows(
          (data ?? []).map((r: any) => ({
            id: r.id,
            takenAt: r.taken_at,
            cameraRmssd: r.camera_rmssd === null ? null : Number(r.camera_rmssd),
            cameraBpm: r.camera_bpm === null ? null : Number(r.camera_bpm),
            watchRmssd: r.watch_rmssd === null ? null : Number(r.watch_rmssd),
            quality: r.quality ?? {},
          })),
        ),
      );
  }, []);

  useEffect(() => {
    if (!open) return;
    loadRows();
    if (VC) {
      void VC.Camera.requestCameraPermission().then((p: string) => setHasPermission(p === 'granted'));
    }
  }, [open, loadRows]);

  useEffect(() => {
    if (phase !== 'capturing') return;
    const iv = setInterval(() => {
      const s = samplesRef.current;
      setElapsed(s.length > 1 ? Math.round((s[s.length - 1]!.t - s[0]!.t) / 1000) : 0);
      setLiveTail(s.slice(-120));
    }, 250);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase === 'capturing' && elapsed >= PPG_RULES.targetDurationS) finishCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  const startCapture = () => {
    samplesRef.current = [];
    setResult(null);
    setMessage(null);
    setElapsed(0);
    setPhase('capturing');
  };

  const finishCapture = () => {
    setPhase('done');
    setResult(analyzePpg(samplesRef.current));
  };

  const saveRow = async () => {
    if (!result) return;
    const watch = watchText.trim() === '' ? null : parseFloat(watchText.replace(',', '.'));
    const { error } = await supabase.from('basalt_ppg_calibration').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      camera_rmssd: result.rmssd,
      camera_bpm: result.bpm,
      quality: result.quality,
      watch_rmssd: Number.isFinite(watch as number) ? watch : null,
    });
    setMessage(error ? error.message : 'Logged.');
    setWatchText('');
    loadRows();
  };

  const onSample = useCallback((t: number, v: number) => {
    samplesRef.current.push({ t, v });
  }, []);

  const wavePoints = (sig: PpgSample[], w: number, h: number): string => {
    if (sig.length < 2) return '';
    const t0 = sig[0]!.t;
    const t1 = sig[sig.length - 1]!.t;
    const vs = sig.map((s) => s.v);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const span = hi - lo || 1;
    return sig
      .map((s) => `${(((s.t - t0) / Math.max(1, t1 - t0)) * w).toFixed(1)},${(h - ((s.v - lo) / span) * h).toFixed(1)}`)
      .join(' ');
  };

  const deltas = rows.filter((r) => r.cameraRmssd !== null && r.watchRmssd !== null);
  const meanAbsDelta = deltas.length > 0
    ? Math.round((deltas.reduce((a, r) => a + Math.abs(r.cameraRmssd! - r.watchRmssd!), 0) / deltas.length) * 10) / 10
    : null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.grab} />
        <ScrollView style={{ maxHeight: 600 }} keyboardShouldPersistTaps="handled">
          <ReceiptHeader label="Camera HRV — tuning bench" summary="dev only · numbers earn trust here first" />

          {!VC ? (
            <EmptyState>The camera module isn't in this build yet — install the latest rebuild and reopen.</EmptyState>
          ) : !hasPermission ? (
            <EmptyState>Camera permission needed — grant it when prompted, then reopen.</EmptyState>
          ) : (
            <>
              {phase !== 'capturing' ? (
                <>
                  <SrcNote>
                    Published measurement conditions: seated, still, phone resting in your hand, fingertip flat over BOTH the lens and the flash with light pressure. Morning reads compare best. 60 seconds.
                  </SrcNote>
                  <CTA label="Start 60 s capture" onPress={startCapture} />
                </>
              ) : (
                <>
                  <PpgCamera onSample={onSample} />
                  <Text style={styles.liveLine}>{`CAPTURING · ${elapsed}s / ${PPG_RULES.targetDurationS}s · ${samplesRef.current.length} frames`}</Text>
                  <Svg width="100%" height={90} viewBox="0 0 320 90">
                    <Polyline points={wavePoints(liveTail, 320, 90)} fill="none" stroke={color.recovery} strokeWidth={1.5} />
                  </Svg>
                  <CTA label="Stop early" onPress={finishCapture} />
                </>
              )}

              {phase === 'done' && result ? (
                <>
                  <Svg width="100%" height={110} viewBox="0 0 320 110">
                    <Polyline points={wavePoints(result.signal.slice(-900), 320, 110)} fill="none" stroke={color.ink2} strokeWidth={1} />
                    {(() => {
                      const sig = result.signal.slice(-900);
                      if (sig.length < 2) return null;
                      const t0 = sig[0]!.t;
                      const t1 = sig[sig.length - 1]!.t;
                      return result.peaksMs
                        .filter((p) => p >= t0 && p <= t1)
                        .map((p, i) => (
                          <Circle key={i} cx={((p - t0) / Math.max(1, t1 - t0)) * 320} cy={8} r={2} fill={color.recovery} />
                        ));
                    })()}
                  </Svg>
                  <ReceiptRow name="Camera RMSSD" value={result.rmssd !== null ? String(result.rmssd) : '—'} unit={result.rmssd !== null ? 'ms' : ''} meta={result.quality.ok ? 'clean read' : `DISCARDED — ${result.quality.reasons.join(' · ')}`} />
                  <ReceiptRow name="Heart rate" value={result.bpm !== null ? String(result.bpm) : '—'} unit={result.bpm !== null ? 'bpm' : ''} />
                  <ReceiptRow
                    name="Quality"
                    meta={`SNR ${result.quality.snr} · ${result.quality.cleanRr} clean beats · ${Math.round(result.quality.artifactFrac * 100)}% artifacts · ${result.quality.fps} fps · ${result.quality.durationS}s`}
                    value={result.quality.ok ? 'PASS' : 'FAIL'}
                    valueColor={result.quality.ok ? color.carbs : color.faint}
                    last
                  />
                  <View style={styles.watchRow}>
                    <ObInput
                      placeholder="Watch RMSSD right now (ms) — optional"
                      value={watchText}
                      onChangeText={setWatchText}
                      keyboardType="decimal-pad"
                      style={{ flex: 1 }}
                    />
                    <Pressable onPress={() => void saveRow()} hitSlop={10}>
                      <Text style={styles.link}>LOG PAIR</Text>
                    </Pressable>
                  </View>
                  <CTA label="Take another" onPress={startCapture} />
                </>
              ) : null}
            </>
          )}

          {message ? <SrcNote>{message}</SrcNote> : null}

          {/* ── The comparison table — the whole point of the morning ── */}
          <ReceiptHeader
            label="Camera vs watch"
            summary={meanAbsDelta !== null ? `${deltas.length} pairs · mean |Δ| ${meanAbsDelta} ms` : rows.length > 0 ? `${rows.length} readings` : undefined}
          />
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <ReceiptRow
                key={r.id}
                name={new Date(r.takenAt).toTimeString().slice(0, 5)}
                meta={`cam ${r.cameraRmssd ?? 'discarded'}${r.cameraRmssd !== null ? ' ms' : ''} · watch ${r.watchRmssd ?? '—'}${r.watchRmssd !== null ? ' ms' : ''} · SNR ${r.quality?.snr ?? '?'}`}
                value={r.cameraRmssd !== null && r.watchRmssd !== null ? `Δ ${Math.round((r.cameraRmssd - r.watchRmssd) * 10) / 10}` : '—'}
                unit={r.cameraRmssd !== null && r.watchRmssd !== null ? 'ms' : ''}
                last={i === rows.length - 1}
              />
            ))
          ) : (
            <EmptyState>No calibration pairs yet — take a capture with your watch on and log both.</EmptyState>
          )}
          <SrcNote>Discarded reads log their quality metrics but never a number — refusal is data too</SrcNote>
          <CTA label="Close" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// Inner component so hooks from the lazily-required module only run when
// the module exists and a capture is active. Low resolution + 30 fps +
// torch on; every frame's mean red channel becomes one sample.
function PpgCamera({ onSample }: { onSample: (t: number, v: number) => void }) {
  const device = VC.useCameraDevice('back');
  const format = VC.useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 30 },
  ]);
  const onSampleJS = Worklets.createRunOnJS(onSample);
  const frameProcessor = VC.useFrameProcessor(
    (frame: any) => {
      'worklet';
      const buf = frame.toArrayBuffer();
      const data = new Uint8Array(buf);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4 * 101) {
        sum += data[i]!;
        n++;
      }
      onSampleJS(frame.timestamp / 1e6, sum / Math.max(1, n));
    },
    [onSampleJS],
  );
  if (!device) return <EmptyState>No back camera found.</EmptyState>;
  const Camera = VC.Camera;
  return (
    <View style={styles.cameraBox}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive
        torch="on"
        pixelFormat="rgb"
        frameProcessor={frameProcessor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingHorizontal: 16, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: 8 },
  cameraBox: { height: 60, borderRadius: 8, overflow: 'hidden', marginVertical: 6, backgroundColor: '#000' },
  liveLine: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: color.ink, textAlign: 'center', paddingVertical: 6 },
  watchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  link: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, color: color.faint, paddingVertical: 10 },
});
