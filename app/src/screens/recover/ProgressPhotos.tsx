import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Switch } from 'react-native';
import { Card, EmptyState, SrcNote, ReceiptHeader, CTA, ChipRow, ReceiptRow, mono, ScaledText as Text } from '@basalt/ui';
import { type ProgressPose } from '@basalt/core-data';
import { useTheme } from '@basalt/ui';
import {
  PHOTOS_CLOUD_WARNING, isCloudSyncOn, listPhotoRecords, savePhoto, setCloudSync,
  type PhotoRecord,
} from '../../lib/progressPhotoStore';

// Progress photos, local-first — photos stay on this phone unless the
// separate cloud switch is flipped, with the trade stated in plain words.
// Ghost-overlay alignment against the previous photo of the same pose,
// side-by-side AND overlay compare. Excluded from exports by default;
// nothing here is ever shared.

const POSES: ProgressPose[] = ['front', 'side', 'back'];

export function ProgressPhotosCard() {
  const { theme } = useTheme();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [pose, setPose] = useState<ProgressPose>('front');
  const [capturing, setCapturing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [cloud, setCloud] = useState(false);

  const refresh = async () => {
    setPhotos(await listPhotoRecords());
  };
  useEffect(() => {
    void refresh();
    void isCloudSyncOn().then(setCloud);
  }, []);

  const flipCloud = async (on: boolean) => {
    await setCloudSync(on);
    setCloud(on);
    void refresh();
  };

  const ofPose = photos.filter((p) => p.pose === pose);
  const latest = ofPose[ofPose.length - 1] ?? null;
  const earliest = ofPose[0] ?? null;

  return (
    <Card>
      <ReceiptHeader label="Progress photos" summary={cloud ? 'this phone + private cloud copy' : 'this phone only'} />
      <ChipRow options={POSES.map((p) => `${p} (${photos.filter((x) => x.pose === p).length})`)}
        value={`${pose} (${ofPose.length})`}
        onChange={(v) => setPose(v.split(' ')[0] as ProgressPose)} />
      {latest ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: latest.uri }} style={[styles.preview, { backgroundColor: theme.surfaces.surface2 }]} />
          <Text style={[styles.previewMeta, { color: theme.text.ink2 }]}>
            {`latest · ${new Date(latest.takenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}\n${ofPose.length} ${ofPose.length === 1 ? 'photo' : 'photos'} of this pose`}
          </Text>
        </View>
      ) : (
        <EmptyState>{`No ${pose} photos yet. The first one becomes the alignment ghost for the next.`}</EmptyState>
      )}
      <CTA label={`Capture ${pose}`} onPress={() => setCapturing(true)} />
      {ofPose.length >= 2 ? (
        <Pressable onPress={() => setComparing(true)}>
          <Text style={[styles.link, { color: theme.text.faint }]}>COMPARE FIRST ↔ LATEST →</Text>
        </Pressable>
      ) : null}
      <ReceiptRow
        name="Cloud sync"
        meta={PHOTOS_CLOUD_WARNING}
        last
        right={
          <Switch
            value={cloud}
            onValueChange={(v) => void flipCloud(v)}
            trackColor={{ false: theme.surfaces.surface2, true: theme.fill.carbs }}
            thumbColor={theme.text.ink}
            accessibilityLabel="Cloud sync for progress photos"
          />
        }
      />
      <SrcNote>{`Alignment guides + a ghost of your previous ${pose} photo · never shared, out of exports unless you say so`}</SrcNote>

      <CaptureSheet
        open={capturing}
        pose={pose}
        ghostUrl={latest?.uri ?? null}
        onClose={() => setCapturing(false)}
        onCaptured={() => {
          setCapturing(false);
          void refresh();
        }}
      />

      <Modal visible={comparing} transparent animationType="fade" onRequestClose={() => setComparing(false)}>
        <Pressable style={styles.dim} onPress={() => setComparing(false)} />
        <View style={[styles.compareSheet, { backgroundColor: theme.surfaces.surface, borderTopColor: theme.surfaces.borderStrong }]}>
          <View style={styles.compareHead}>
            <Text style={[styles.sheetTitle, { color: theme.text.mute }]}>{pose.toUpperCase()} — FIRST vs LATEST</Text>
            <Pressable onPress={() => setOverlay(!overlay)} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.sheetTitle, { color: theme.text.carbs }]}>{overlay ? 'SIDE BY SIDE' : 'OVERLAY'}</Text>
            </Pressable>
          </View>
          {overlay && earliest && latest ? (
            <View style={styles.overlayBox}>
              <Image source={{ uri: earliest.uri }} style={[styles.overlayImg, { backgroundColor: theme.surfaces.surface2 }]} />
              <Image source={{ uri: latest.uri }} style={[styles.overlayImg, styles.overlayTop]} />
              <Text style={[styles.compareDate, { color: theme.text.mute }]}>
                {`first under, latest over at half strength — ${new Date(earliest.takenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} → ${new Date(latest.takenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
              </Text>
            </View>
          ) : (
          <View style={styles.compareRow}>
            {[earliest, latest].map((p, i) =>
              p ? (
                <View key={p.id} style={{ flex: 1 }}>
                  <Image source={{ uri: p.uri }} style={[styles.compareImg, { backgroundColor: theme.surfaces.surface2 }]} />
                  <Text style={[styles.compareDate, { color: theme.text.mute }]}>
                    {new Date(p.takenAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ) : (
                <View key={i} style={{ flex: 1 }} />
              ),
            )}
          </View>
          )}
        </View>
      </Modal>
    </Card>
  );
}

function CaptureSheet({ open, pose, ghostUrl, onClose, onCaptured }: {
  open: boolean;
  pose: ProgressPose;
  ghostUrl: string | null;
  onClose: () => void;
  onCaptured: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [camRef, setCamRef] = useState<CameraView | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && permission && !permission.granted) void requestPermission();
  }, [open, permission, requestPermission]);

  const shoot = async () => {
    if (!camRef || busy) return;
    setBusy(true);
    try {
      const raw = await camRef.takePictureAsync({ quality: 0.85 });
      if (raw?.uri) {
        const small = await ImageManipulator.manipulateAsync(
          raw.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (small.base64) {
          const saved = await savePhoto(pose, small.base64);
          if (saved.ok) onCaptured();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.captureRoot}>
        {permission?.granted ? (
          <CameraView ref={(r) => setCamRef(r)} style={StyleSheet.absoluteFill} facing={facing} />
        ) : (
          <EmptyState>Camera permission is off — grant it in system settings to capture.</EmptyState>
        )}
        {/* Ghost of the previous photo of this pose */}
        {ghostUrl ? (
          <Image source={{ uri: ghostUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.28 }]} resizeMode="cover" />
        ) : null}
        {/* Alignment guides: centre line + head/hip lines */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={styles.vGuide} />
          <View style={[styles.hGuide, { top: '14%' }]} />
          <View style={[styles.hGuide, { top: '58%' }]} />
        </View>
        <View style={[styles.captureHud, { top: insets.top + 12 }]}>
          <Text style={[styles.hudText, { color: theme.text.ink }]}>{pose.toUpperCase()} · {ghostUrl ? 'GHOST = YOUR PREVIOUS PHOTO' : 'FIRST PHOTO OF THIS POSE'}</Text>
        </View>
        <View style={[styles.captureBar, { paddingBottom: 18 + insets.bottom }]}>
          <Pressable onPress={onClose}>
            <Text style={[styles.hudText, { color: theme.text.ink }]}>CANCEL</Text>
          </Pressable>
          <Pressable onPress={() => void shoot()} disabled={busy}>
            <View style={[styles.shutter, { borderColor: theme.fill.mark }, busy && { opacity: 0.4 }]} />
          </Pressable>
          <Pressable onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}>
            <Text style={[styles.hudText, { color: theme.text.ink }]}>FLIP</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  previewRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 10 },
  preview: { width: 72, height: 96, borderRadius: 10 },
  previewMeta: { fontFamily: mono, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.3 },
  link: { fontFamily: mono, fontSize: 10.5, letterSpacing: 0.85, textAlign: 'center', paddingVertical: 10 },
  sheetTitle: { fontFamily: mono, fontSize: 11, letterSpacing: 1.2 },
  compareSheet: { borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34,
  },
  compareRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  compareHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overlayBox: { marginTop: 14, gap: 6 },
  overlayImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10 },
  overlayTop: { position: 'absolute', top: 0, left: 0, opacity: 0.5 },
  compareImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10 },
  compareDate: { fontFamily: mono, fontSize: 11, textAlign: 'center', marginTop: 6 },
  captureRoot: { flex: 1, backgroundColor: '#000' },
  vGuide: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(244,245,246,0.5)' },
  hGuide: { position: 'absolute', left: '12%', right: '12%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(244,245,246,0.5)' },
  captureHud: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hudText: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, backgroundColor: 'rgba(15,17,21,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, overflow: 'hidden' },
  captureBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 14,
  },
  shutter: { width: 62, height: 62, borderRadius: 31, borderWidth: 4, backgroundColor: 'rgba(244,245,246,0.25)' },
});
