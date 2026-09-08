import { useEffect, useState } from 'react';
import { Card, ReceiptHeader, ReceiptRow, SrcNote, useTheme, ScaledText as Text } from '@basalt/ui';
import { StyleSheet } from 'react-native';
import type { RegionVolume, VolumeProposal } from '@basalt/training';
import { volumeLine } from '@basalt/training';
import { loadWeeklyVolume, loadVolumeProposals } from '../../lib/weeklyVolumeData';
import { supabase } from '../../lib/supabase';

// Weekly hard sets per muscle (V4 Phase 8-0, core Train summary). A hard
// set is RIR ≤ 3 (unlogged RIR counts as hard); the 10–20 band is the
// published guidance, and the two-week rule proposes one set up or down
// per region — a proposal, never a mandate.

export function HardSetsCard() {
  const { theme } = useTheme();
  const [regions, setRegions] = useState<RegionVolume[] | null>(null);
  const [proposals, setProposals] = useState<VolumeProposal[]>([]);

  useEffect(() => {
    void loadWeeklyVolume(supabase).then((r) => r.ok && setRegions(r.data.regions));
    void loadVolumeProposals(supabase).then(setProposals);
  }, []);

  if (!regions || regions.length === 0) return null;

  return (
    <Card>
      <ReceiptHeader label="Hard sets this week" summary="RIR ≤ 3 counts · 10–20 band" />
      {regions.slice(0, 6).map((v, i) => (
        <ReceiptRow
          key={v.region}
          name={v.region}
          meta={volumeLine(v)}
          value={Number.isInteger(v.sets) ? String(v.sets) : v.sets.toFixed(1)}
          unit="sets"
          valueColor={v.position === 'inside' ? undefined : theme.text.fat}
          last={i === Math.min(regions.length, 6) - 1 && proposals.length === 0}
        />
      ))}
      {proposals.map((p) => (
        <Text key={p.region + p.kind} style={[styles.proposal, { color: theme.text.mute }]}>
          {p.reason}
        </Text>
      ))}
      <SrcNote>A hard set is RIR ≤ 3 — unlogged RIR counts as hard · half credit for secondary muscles · the band is guidance to compare against, never a prescription</SrcNote>
    </Card>
  );
}

const styles = StyleSheet.create({
  proposal: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
});
