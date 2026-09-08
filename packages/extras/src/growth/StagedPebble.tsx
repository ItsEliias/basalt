import Svg, { Circle, Path, Polygon } from 'react-native-svg';

// The five growth stages — same pebble, more detail, never a different
// character. Stage is a pure function of the published score; this file
// only draws. Stage 3 is exactly the classic Pebble; 1–2 are quieter,
// 4–5 add facets and a sprout.

export function StagedPebble({ stage, size = 44 }: { stage: 1 | 2 | 3 | 4 | 5; size?: number }) {
  return (
    <Svg viewBox="0 0 80 64" width={size} height={(size * 64) / 80} aria-label={`Pebble, stage ${stage} of 5`}>
      {/* body — every stage */}
      <Path d="M12 40 C8 18 30 6 46 8 C66 10 76 26 72 42 C68 58 50 62 36 60 C22 58 14 52 12 40Z" fill="#3F4756" />
      {/* stage 3+: the brow highlight */}
      {stage >= 3 ? (
        <Path d="M22 22 C30 14 44 12 56 16" stroke="#59627A" strokeWidth={3} fill="none" strokeLinecap="round" />
      ) : null}
      {/* stage 4+: facet highlights */}
      {stage >= 4 ? (
        <>
          <Polygon points="18,34 24,28 27,36" fill="#4A5368" />
          <Polygon points="58,22 64,27 59,31" fill="#4A5368" />
        </>
      ) : null}
      {/* eyes — every stage */}
      <Circle cx={32} cy={32} r={5} fill="#FFF" />
      <Circle cx={52} cy={32} r={5} fill="#FFF" />
      <Circle cx={33.5} cy={33} r={2.4} fill="#111" />
      <Circle cx={53.5} cy={33} r={2.4} fill="#111" />
      {/* smile — every stage; stage 1 keeps it smaller */}
      {stage === 1 ? (
        <Path d="M38 44 C40 46 46 46 48 44" stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M36 44 C40 48 46 48 50 44" stroke="#111" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      )}
      {/* stage 2+: blush */}
      {stage >= 2 ? (
        <>
          <Circle cx={24} cy={40} r={3.5} fill="#FF9AAE" opacity={0.8} />
          <Circle cx={60} cy={40} r={3.5} fill="#FF9AAE" opacity={0.8} />
        </>
      ) : null}
      {/* stage 5: the sprout */}
      {stage >= 5 ? (
        <>
          <Path d="M44 8 C44 4 44 2 44 1" stroke="#3E9B78" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d="M44 3 C41 1 38 1 36 2 C38 5 41 5 44 3Z" fill="#3E9B78" />
          <Path d="M44 3 C47 0 50 0 52 1 C50 4 47 5 44 3Z" fill="#4FB98F" />
        </>
      ) : null}
    </Svg>
  );
}
