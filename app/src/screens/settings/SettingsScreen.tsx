import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Card, EmptyState, SrcNote, ReceiptHeader, ReceiptRow, CTA, ObInput, ObChipLabel,
  ChipRow, ChipGroup, kgText, groupInt,
  color, mono,
} from '@basalt/ui';
import { saveProfile, type ProfileRecord } from '@basalt/core-data';
import { healthService, ALL_HEALTH_PERMISSIONS } from '@basalt/health-connect';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../state/appStore';
import { collectExport } from '../../lib/exportData';
import { shareDoctorReport } from '../../lib/doctorReport';
import { zipSync, strToU8 } from 'fflate';
import {
  buildPerTableCsvs, buildExportReadme, u8ToBase64,
} from '../../lib/exportFormat';
import {
  disableWeekReviewNotif, enableWeekReviewNotif, isWeekReviewNotifEnabled,
} from '../../lib/weekReviewNotif';
import { buildJson, buildSectionedCsv } from '../../lib/exportFormat';
import { recomputeTargetsFromProfile } from '../../lib/recomputeTargets';
import {
  GOAL_OPTIONS, SEX_OPTIONS, ALLERGY_OPTIONS, DIET_OPTIONS, EQUIPMENT_OPTIONS,
  CHECKIN_OPTIONS, checkinKey, sexKey,
} from '../onboarding/model';

// Settings — every onboarding answer editable, your data yours fully, delete
// is a true full cascade (Edge Function; the shared-auth caveat is stated,
// not hidden).

type EditKey = 'basics' | 'goals' | 'dietary' | 'training' | null;

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const targets = useAppStore((s) => s.targets);
  const session = useAppStore((s) => s.session);
  const refreshCore = useAppStore((s) => s.refreshCore);
  const signOut = useAppStore((s) => s.signOut);

  const [edit, setEdit] = useState<EditKey>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hcStatus, setHcStatus] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [weekNotif, setWeekNotif] = useState<boolean | null>(null);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [weekNotifNote, setWeekNotifNote] = useState<string | null>(null);

  useEffect(() => {
    void isWeekReviewNotifEnabled().then(setWeekNotif);
  }, []);

  const toggleWeekNotif = async () => {
    if (weekNotif === null) return;
    setBusy('notif');
    if (weekNotif) {
      await disableWeekReviewNotif();
      setWeekNotif(false);
      setWeekNotifNote(null);
    } else {
      const r = await enableWeekReviewNotif();
      setWeekNotif(r.ok);
      setWeekNotifNote(r.ok ? null : (r.reason ?? null));
    }
    setBusy(null);
  };

  const save = async (patch: Partial<ProfileRecord>, recompute = false) => {
    setBusy('save');
    const saved = await saveProfile(supabase, patch);
    if (saved.ok && recompute) await recomputeTargetsFromProfile(saved.data);
    await refreshCore();
    setBusy(null);
    setEdit(null);
  };

  const shareText = async (filename: string, contents: string, mime: string) => {
    setBusy(filename);
    try {
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, contents);
      await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: filename });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not write the export file.');
    }
    setBusy(null);
  };

  const exportJson = async () => {
    const bundle = await collectExport(includePhotos);
    await shareText('basalt-export.json', buildJson(bundle), 'application/json');
  };
  const exportCsv = async () => {
    const bundle = await collectExport(includePhotos);
    await shareText('basalt-export.csv', buildSectionedCsv(bundle), 'text/csv');
  };
  const exportZip = async () => {
    setBusy('basalt-export.zip');
    try {
      const bundle = await collectExport(includePhotos);
      const files = buildPerTableCsvs(bundle);
      const zipped = zipSync({
        'README.txt': strToU8(buildExportReadme(bundle, new Date().toISOString())),
        ...Object.fromEntries(files.map((f) => [f.name, strToU8(f.csv)])),
      });
      const path = `${FileSystem.cacheDirectory}basalt-export.zip`;
      await FileSystem.writeAsStringAsync(path, u8ToBase64(zipped), {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(path, { mimeType: 'application/zip', dialogTitle: 'basalt-export.zip' });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not build the archive.');
    }
    setBusy(null);
  };

  const connectSources = async () => {
    setBusy('hc');
    const avail = await healthService.isAvailable();
    if (!avail.ok || avail.data !== 'available') {
      setHcStatus(
        avail.ok && avail.data === 'unsupported_platform'
          ? 'No health platform on this device (iOS support is V1.x).'
          : 'Health Connect is not available — install or update it from the Play Store.',
      );
      setBusy(null);
      return;
    }
    const granted = await healthService.requestPermissions(ALL_HEALTH_PERMISSIONS);
    setHcStatus(
      granted.ok && granted.data.length > 0
        ? `Connected — ${granted.data.length} of ${ALL_HEALTH_PERMISSIONS.length} read permissions granted.`
        : 'No permissions granted.',
    );
    setBusy(null);
  };

  const deleteAccount = async () => {
    setBusy('delete');
    const { data, error } = await supabase.functions.invoke('delete-account');
    setBusy(null);
    setDeleteOpen(false);
    if (error) {
      Alert.alert('Delete failed', error.message ?? 'Could not delete the account.');
      return;
    }
    Alert.alert('Account deleted', (data as any)?.note ?? 'Every Basalt row is gone.');
    await signOut();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── Profile ────────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Profile" summary="everything editable" />
        <Pressable onPress={() => setEdit('basics')}>
          <ReceiptRow
            name={profile?.name?.trim() || 'Your details'}
            meta={[
              profile?.heightCm ? `${profile.heightCm} cm` : null,
              profile?.ageYears ? `${profile.ageYears} y` : null,
              profile?.useMetric === false ? 'imperial' : 'metric',
            ].filter(Boolean).join(' · ') || 'not set yet'}
            value="edit →"
            valueColor={color.faint}
          />
        </Pressable>
        <Pressable onPress={() => setEdit('goals')}>
          <ReceiptRow
            name="Goals"
            meta={
              (profile?.goalTypes?.length ?? 0) > 0
                ? profile!.goalTypes.map((g) => GOAL_OPTIONS.find((o) => o.key === g)?.title ?? g).join(' + ')
                : 'none set'
            }
            value="change →"
            valueColor={color.faint}
          />
        </Pressable>
        <ReceiptRow
          name="Daily targets"
          meta={
            targets
              ? `${groupInt(targets.calories)} kcal · P ${targets.proteinG}${targets.sugarCapG != null ? ` · sugar cap ${targets.sugarCapG} g` : ''}`
              : 'no targets yet — set goals + basics and recompute'
          }
          value={targets ? undefined : undefined}
        />
        {targets?.reason ? <SrcNote>{`Why: ${targets.reason}`}</SrcNote> : null}
        <Pressable onPress={() => setEdit('dietary')}>
          <ReceiptRow
            name="Dietary requirements"
            meta={
              [...(profile?.dietaryFlags ?? []), ...(profile?.dietPatterns ?? [])].join(' · ') || 'none set'
            }
            value="edit →"
            valueColor={color.faint}
          />
        </Pressable>
        <Pressable onPress={() => setEdit('training')}>
          <ReceiptRow
            name="Training setup"
            meta={
              profile?.trainLocation
                ? `${profile.trainLocation}${profile.trainLocation !== 'gym' ? ` · ${profile.equipment.length} items at home` : ''}`
                : 'not set'
            }
            value="edit →"
            valueColor={color.faint}
            last
          />
        </Pressable>
      </Card>

      {/* ── Preferences ────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Preferences" />
        <ObChipLabel>Check-ins</ObChipLabel>
        <ChipRow
          options={CHECKIN_OPTIONS}
          value={CHECKIN_OPTIONS.find((o) => checkinKey(o) === profile?.checkinPreference)}
          onChange={(v) => void save({ checkinPreference: checkinKey(v) })}
        />
        <ObChipLabel>Connected sources</ObChipLabel>
        <CTA label={busy === 'hc' ? '…' : 'Connect Health Connect'} onPress={connectSources} disabled={busy !== null} />
        {hcStatus ? <SrcNote>{hcStatus}</SrcNote> : (
          <SrcNote>Steps, sleep, vitals and more — read-only, every synced value shows its source</SrcNote>
        )}
        <ObChipLabel>Nutrition display</ObChipLabel>
        <Pressable onPress={() => void save({ hideNumbers: !(profile?.hideNumbers ?? false) })} disabled={busy !== null}>
          <ReceiptRow
            name="Hide the numbers"
            meta="log-only mode: everything is still recorded and exported — calories and macros just aren't shown. For anyone the numbers aren't kind to."
            value={profile?.hideNumbers ? 'on' : 'off'}
            valueColor={profile?.hideNumbers ? color.carbs : color.faint}
            last
          />
        </Pressable>
        <ObChipLabel>Fasting module</ObChipLabel>
        <Pressable onPress={() => void save({ fastingEnabled: !(profile?.fastingEnabled ?? false) })} disabled={busy !== null}>
          <ReceiptRow
            name="Fasting timer"
            meta="a window timer with documented stages — information, not medical advice. Off unless you want it."
            value={profile?.fastingEnabled ? 'on' : 'off'}
            valueColor={profile?.fastingEnabled ? color.carbs : color.faint}
            last
          />
        </Pressable>
        <ObChipLabel>Week in review</ObChipLabel>
        <Pressable onPress={() => void toggleWeekNotif()} disabled={busy !== null || weekNotif === null}>
          <ReceiptRow
            name="Sunday 18:00 notification"
            meta={weekNotifNote ?? 'a fixed prompt — never data in the notification itself'}
            metaAccent={weekNotifNote ? color.fat : undefined}
            value={weekNotif === null ? '…' : weekNotif ? 'on' : 'off'}
            valueColor={weekNotif ? color.carbs : color.faint}
            last
          />
        </Pressable>
      </Card>

      {/* ── Your data ──────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Your data" summary="yours, fully" />
        <Pressable onPress={() => void exportJson()} disabled={busy !== null}>
          <ReceiptRow
            name={busy === 'basalt-export.json' ? 'Exporting…' : 'Export everything — JSON'}
            meta="every table, one file, one tap"
            value="→"
            valueColor={color.faint}
          />
        </Pressable>
        <Pressable onPress={() => void exportCsv()} disabled={busy !== null}>
          <ReceiptRow
            name={busy === 'basalt-export.csv' ? 'Exporting…' : 'Export everything — CSV'}
            meta="sectioned per table, spreadsheet-ready"
            value="→"
            valueColor={color.faint}
          />
        </Pressable>
        <Pressable
          onPress={async () => {
            setBusy('doctor');
            try {
              await shareDoctorReport();
            } catch (e: any) {
              Alert.alert('Report failed', e?.message ?? 'Could not build the PDF.');
            }
            setBusy(null);
          }}
          disabled={busy !== null}
        >
          <ReceiptRow
            name={busy === 'doctor' ? 'Building…' : 'Doctor report — PDF'}
            meta="last 30 days: weight trend, sleep, activity, vitals — sources named, absent data stated, nothing estimated"
            value="→"
            valueColor={color.faint}
          />
        </Pressable>
        <Pressable onPress={() => setIncludePhotos(!includePhotos)}>
          <ReceiptRow
            name="Include progress-photo records"
            meta="off by default — the vault stays out of exports unless you say so (records only; the photos themselves stay in private storage)"
            value={includePhotos ? 'on' : 'off'}
            valueColor={includePhotos ? color.carbs : color.faint}
          />
        </Pressable>
        <Pressable onPress={() => void exportZip()} disabled={busy !== null}>
          <ReceiptRow
            name={busy === 'basalt-export.zip' ? 'Exporting…' : 'Export everything — CSV archive'}
            meta="one file per table, zipped · README lists every table incl. empty ones"
            value="→"
            valueColor={color.faint}
            last
          />
        </Pressable>
      </Card>

      {/* ── Account ────────────────────────────────────────────────── */}
      <Card>
        <ReceiptHeader label="Account" />
        <ReceiptRow name={session?.user.email ?? '—'} meta="free plan" />
        <Pressable onPress={() => void signOut()}>
          <ReceiptRow name="Sign out" />
        </Pressable>
        <Pressable onPress={() => setDeleteOpen(true)}>
          <ReceiptRow
            name="Delete account & all data"
            meta="type-to-confirm · removes every table row, then the sign-in record"
            metaAccent={color.fat}
            value="→"
            valueColor={color.fat}
            last
          />
        </Pressable>
      </Card>
      <SrcNote>
        Delete is a full cascade — required by Google Play & App Store policy, and also just right.
        While Basalt shares its backend with Arise, the sign-in record itself is removed only when no
        Arise data depends on it; the app tells you which happened.
      </SrcNote>

      {/* ── Edit sheets ────────────────────────────────────────────── */}
      <EditSheet open={edit !== null} onClose={() => setEdit(null)} bottomInset={insets.bottom}>
        {edit === 'basics' ? <BasicsEditor profile={profile} busy={busy !== null} onSave={save} /> : null}
        {edit === 'goals' ? <GoalsEditor profile={profile} busy={busy !== null} onSave={save} /> : null}
        {edit === 'dietary' ? <DietaryEditor profile={profile} busy={busy !== null} onSave={save} /> : null}
        {edit === 'training' ? <TrainingEditor profile={profile} busy={busy !== null} onSave={save} /> : null}
      </EditSheet>

      {/* ── Delete confirm ─────────────────────────────────────────── */}
      <EditSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} bottomInset={insets.bottom}>
        <Text style={styles.deleteTitle}>Delete account & all data</Text>
        <Text style={styles.deleteBody}>
          This removes every row in every table — food, sessions, sets, water, weight, sleep, targets,
          profile — and then the sign-in record itself where nothing else depends on it. There is no
          undo and no grace period. Type DELETE to confirm.
        </Text>
        <ObInput placeholder="Type DELETE" autoCapitalize="characters" value={confirmText} onChangeText={setConfirmText} />
        <CTA
          label={busy === 'delete' ? '…' : 'Delete everything'}
          disabled={confirmText.trim() !== 'DELETE' || busy !== null}
          onPress={() => void deleteAccount()}
        />
      </EditSheet>
    </ScrollView>
  );
}

function EditSheet({ open, onClose, children, bottomInset }: {
  open: boolean; onClose: () => void; children: React.ReactNode; bottomInset: number;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 22 + bottomInset }]}>
        <View style={styles.grab} />
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

function BasicsEditor({ profile, busy, onSave }: EditorProps) {
  const [name, setName] = useState(profile?.name ?? '');
  const [age, setAge] = useState(profile?.ageYears ? String(profile.ageYears) : '');
  const [height, setHeight] = useState(profile?.heightCm ? String(profile.heightCm) : '');
  const [sex, setSex] = useState<string | null>(
    SEX_OPTIONS.find((o) => sexKey(o) === profile?.biologicalSex) ?? null,
  );
  return (
    <>
      <ObInput placeholder="Name" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ObInput placeholder="Age" keyboardType="number-pad" value={age} onChangeText={setAge} />
        <ObInput placeholder="Height (cm)" keyboardType="decimal-pad" value={height} onChangeText={setHeight} />
      </View>
      <ObChipLabel>Sex — used only for the energy formula</ObChipLabel>
      <ChipRow options={[...SEX_OPTIONS]} value={sex ?? undefined} onChange={setSex} />
      <CTA
        label={busy ? '…' : 'Save & recompute targets'}
        disabled={busy}
        onPress={() =>
          void onSave(
            {
              name: name.trim() || null,
              ageYears: age ? Math.round(parseFloat(age)) : null,
              heightCm: height ? parseFloat(height.replace(',', '.')) : null,
              biologicalSex: sexKey(sex),
            },
            true,
          )
        }
      />
    </>
  );
}

function GoalsEditor({ profile, busy, onSave }: EditorProps) {
  const [goals, setGoals] = useState<string[]>(profile?.goalTypes ?? []);
  return (
    <>
      <ObChipLabel>Goals — pick as many as apply</ObChipLabel>
      <ChipGroup
        options={GOAL_OPTIONS.map((g) => g.title)}
        values={GOAL_OPTIONS.filter((g) => goals.includes(g.key)).map((g) => g.title)}
        onToggle={(title) => {
          const key = GOAL_OPTIONS.find((g) => g.title === title)!.key;
          setGoals((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
        }}
      />
      <SrcNote>Conflicting pairs (lose + build) balance toward recomposition — the targets say so</SrcNote>
      <CTA label={busy ? '…' : 'Save & recompute targets'} disabled={busy} onPress={() => void onSave({ goalTypes: goals }, true)} />
    </>
  );
}

function DietaryEditor({ profile, busy, onSave }: EditorProps) {
  const [allergies, setAllergies] = useState<string[]>(profile?.dietaryFlags ?? []);
  const [diets, setDiets] = useState<string[]>(profile?.dietPatterns ?? []);
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  return (
    <>
      <ObChipLabel>Allergies & intolerances</ObChipLabel>
      <ChipGroup options={ALLERGY_OPTIONS} values={allergies} onToggle={toggle(setAllergies)} />
      <ObChipLabel>Diet & belief</ObChipLabel>
      <ChipGroup options={DIET_OPTIONS} values={diets} onToggle={toggle(setDiets)} />
      <CTA label={busy ? '…' : 'Save'} disabled={busy} onPress={() => void onSave({ dietaryFlags: allergies, dietPatterns: diets })} />
    </>
  );
}

function TrainingEditor({ profile, busy, onSave }: EditorProps) {
  const [place, setPlace] = useState<'gym' | 'home' | 'both' | null>(profile?.trainLocation ?? null);
  const [equipment, setEquipment] = useState<string[]>(profile?.equipment ?? []);
  return (
    <>
      <ObChipLabel>Where do you train?</ObChipLabel>
      <ChipRow options={['gym', 'home', 'both']} value={place ?? undefined} onChange={(v) => setPlace(v as any)} />
      {place !== 'gym' ? (
        <>
          <ObChipLabel>Home equipment</ObChipLabel>
          <ChipGroup
            options={EQUIPMENT_OPTIONS}
            values={equipment}
            onToggle={(v) => setEquipment((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
          />
        </>
      ) : null}
      <CTA
        label={busy ? '…' : 'Save'}
        disabled={busy}
        onPress={() => void onSave({ trainLocation: place, equipment: place === 'gym' ? [] : equipment })}
      />
    </>
  );
}

type EditorProps = {
  profile: ProfileRecord | null;
  busy: boolean;
  onSave: (patch: Partial<ProfileRecord>, recompute?: boolean) => Promise<void>;
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  dim: { flex: 1, backgroundColor: 'rgba(5,6,8,.6)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grab: { width: 34, height: 3, borderRadius: 2, backgroundColor: color.border2, alignSelf: 'center', marginTop: 4, marginBottom: 10 },
  deleteTitle: { fontSize: 16, fontWeight: '600', color: color.fat, marginTop: 6 },
  deleteBody: { fontSize: 13, lineHeight: 20, color: color.ink2, marginTop: 10 },
});
