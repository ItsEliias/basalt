import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  color, mono, CTA, ObInput, ObChipLabel, ChipRow, SrcNote, EmptyState,
  ReceiptHeader, ReceiptRow, ScaledText as Text,
} from '@basalt/ui';
import {
  parseStrongCsv, parseHevyCsv, parseGenericCsv, parseBasaltSectionedCsv,
  buildImportPreview, commitImport, getExercises, normalizeExerciseName,
  type ImportedSession, type ImportPreview, type ImportCommitReport,
} from '@basalt/training';
import { supabase } from '../../lib/supabase';
import { logLoggingEvent } from '../../lib/instrumentation';

// Competitor import — Strong / Hevy / generic CSV / Basalt's own export,
// through a DRY-RUN preview before anything commits: session count, date
// range, set count, and every unmatched exercise name with a manual
// mapping field. Unmatched names still import as written (exercise_name
// is the record; exercise_id is a link, not a gate). Imported sessions
// carry source `import:<format>` and a stable ext_id, so re-importing the
// same file skips instead of duplicating.

type Format = 'Strong' | 'Hevy' | 'Generic' | 'Basalt';

export function ImportSheet({ open, onClose, onImported }: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [format, setFormat] = useState<Format>('Strong');
  const [text, setText] = useState('');
  const [genericCols, setGenericCols] = useState<{ date?: string; exercise?: string; weight?: string; reps?: string }>({});
  const [genericUnit, setGenericUnit] = useState<'kg' | 'lb'>('kg');
  const [sessions, setSessions] = useState<ImportedSession[] | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportCommitReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headerCols = (() => {
    const line = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
    const delim = line.split(';').length > line.split(',').length ? ';' : ',';
    return line.split(delim).map((c) => c.replace(/"/g, '').trim()).filter(Boolean);
  })();

  const runPreview = async () => {
    setError(null);
    setReport(null);
    let parsed: ImportedSession[] = [];
    try {
      if (format === 'Strong') parsed = parseStrongCsv(text);
      else if (format === 'Hevy') parsed = parseHevyCsv(text);
      else if (format === 'Basalt') parsed = parseBasaltSectionedCsv(text);
      else {
        const col = (name?: string) => (name ? headerCols.indexOf(name) : -1);
        const iDate = col(genericCols.date);
        const iEx = col(genericCols.exercise);
        if (iDate === -1 || iEx === -1) {
          setError('Pick at least the date and exercise columns.');
          return;
        }
        parsed = parseGenericCsv(text, {
          date: iDate,
          exercise: iEx,
          weight: col(genericCols.weight) === -1 ? undefined : col(genericCols.weight),
          reps: col(genericCols.reps) === -1 ? undefined : col(genericCols.reps),
          weightFactor: genericUnit === 'lb' ? 0.45359237 : 1,
        });
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not parse that CSV.');
      return;
    }
    if (parsed.length === 0) {
      setError('No sessions found — check the format matches the file.');
      return;
    }
    const cat = await getExercises(supabase, { limit: 1000 });
    const names = cat.ok ? cat.data.map((e) => ({ id: e.id, name: e.name })) : [];
    setCatalog(names);
    setSessions(parsed);
    setPreview(buildImportPreview(parsed, names.map((n) => n.name)));
    setOverrides({});
  };

  const runImport = async () => {
    if (!sessions || !preview) return;
    setBusy(true);
    const idByName = new Map(catalog.map((c) => [normalizeExerciseName(c.name), c.id]));
    const r = await commitImport(supabase, sessions, {
      source: format.toLowerCase(),
      exerciseIdFor: (name) => {
        const target = overrides[name] ?? preview.matched[name];
        return target ? (idByName.get(normalizeExerciseName(target)) ?? null) : null;
      },
    });
    setBusy(false);
    if (r.ok) {
      setReport(r.data);
      logLoggingEvent({ type: 'entry_saved', source: `import:${format.toLowerCase()}`, viaTray: false });
      onImported();
    } else {
      setError(r.error);
    }
  };

  const reset = () => {
    setSessions(null);
    setPreview(null);
    setReport(null);
    setError(null);
    setText('');
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.grab} />
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
          <ReceiptHeader label="Import training history" summary="dry-run first, always" />
          <ObChipLabel>Source</ObChipLabel>
          <ChipRow
            options={['Strong', 'Hevy', 'Generic', 'Basalt']}
            value={format}
            onChange={(v) => { setFormat(v as Format); setSessions(null); setPreview(null); }}
          />
          <ObInput
            placeholder="Paste the CSV export here"
            value={text}
            onChangeText={(t) => { setText(t); setSessions(null); setPreview(null); }}
            multiline
            style={styles.pasteBox}
          />
          {format === 'Generic' && headerCols.length > 1 ? (
            <>
              {(['date', 'exercise', 'weight', 'reps'] as const).map((field) => (
                <View key={field}>
                  <ObChipLabel>{`${field} column${field === 'weight' || field === 'reps' ? ' (optional)' : ''}`}</ObChipLabel>
                  <ChipRow
                    options={headerCols.slice(0, 8)}
                    value={genericCols[field]}
                    onChange={(v) => setGenericCols((c) => ({ ...c, [field]: v }))}
                  />
                </View>
              ))}
              <ObChipLabel>Weight unit</ObChipLabel>
              <ChipRow options={['kg', 'lb']} value={genericUnit} onChange={(v) => setGenericUnit(v as 'kg' | 'lb')} />
            </>
          ) : null}

          {!preview ? (
            <CTA label="Preview — nothing commits" disabled={!text.trim()} onPress={() => void runPreview()} />
          ) : null}
          {error ? <EmptyState>{error}</EmptyState> : null}

          {preview && sessions ? (
            <>
              <ReceiptRow name="Sessions" value={String(preview.sessionCount)} unit="" />
              <ReceiptRow name="Sets" value={String(preview.setCount)} unit="" />
              <ReceiptRow
                name="Date range"
                value={preview.firstDate === preview.lastDate ? (preview.firstDate ?? '—') : `${preview.firstDate} → ${preview.lastDate}`}
                unit=""
                last={preview.unmatched.length === 0}
              />
              {preview.unmatched.length > 0 ? (
                <>
                  <ObChipLabel>{`${preview.unmatched.length} exercise ${preview.unmatched.length === 1 ? 'name' : 'names'} without a library match`}</ObChipLabel>
                  {preview.unmatched.map((name) => (
                    <View key={name}>
                      <Text style={styles.unmatchedName}>{name}</Text>
                      <ObInput
                        placeholder="Map to a library exercise (optional — imports as written otherwise)"
                        value={overrides[name] ?? ''}
                        onChangeText={(v) => setOverrides((o) => ({ ...o, [name]: v }))}
                      />
                    </View>
                  ))}
                  <SrcNote>Unmapped names still import exactly as written — the name is the record, the library link is optional</SrcNote>
                </>
              ) : null}
              {report === null ? (
                <CTA label={busy ? 'Importing…' : `Import ${preview.sessionCount} ${preview.sessionCount === 1 ? 'session' : 'sessions'}`} disabled={busy} onPress={() => void runImport()} />
              ) : (
                <>
                  <EmptyState>
                    {`Imported ${report.imported} ${report.imported === 1 ? 'session' : 'sessions'} (${report.setsWritten} sets)` +
                      (report.skipped > 0 ? ` · ${report.skipped} already present, skipped` : '') +
                      (report.failed.length > 0 ? ` · ${report.failed.length} failed` : '')}
                  </EmptyState>
                  <CTA label="Done" onPress={() => { reset(); onClose(); }} />
                </>
              )}
            </>
          ) : null}
          <SrcNote>Imported sessions are tagged with their source and skip on re-import — running the same file twice never duplicates</SrcNote>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  pasteBox: { minHeight: 88, maxHeight: 150 },
  unmatchedName: { fontFamily: mono, fontSize: 11, letterSpacing: 0.5, color: color.ink2, marginTop: 10 },
});
