import type { BodyRegion } from '../muscle-map';

// The generator's exercise catalog (V4 Phase 8b) — data, not code. Every
// entry: movement pattern, muscles, the equipment it actually REQUIRES
// (empty = bodyweight), difficulty 1–3, substitutions across equipment
// tiers, and a two-sentence cue — what to do and what to avoid. The 15
// descriptions from Cody's sheet are embedded verbatim as the first
// sentence of their cues (marked ¹ in the source). No videos: the demo
// link is an honest web search.

export type MovementPattern =
  | 'squat' | 'hinge' | 'push-h' | 'push-v' | 'pull-h' | 'pull-v' | 'carry' | 'core'
  | 'accessory';

export type EquipmentItem =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'bands' | 'bench' | 'pullupbar'
  | 'rack' | 'cable' | 'machine' | 'cardio';

export type CatalogExercise = {
  id: string;
  name: string;
  pattern: MovementPattern;
  primary: BodyRegion[];
  secondary: BodyRegion[];
  /** Everything REQUIRED; empty array = bodyweight only. */
  equipment: EquipmentItem[];
  difficulty: 1 | 2 | 3;
  unilateral?: boolean;
  compound?: boolean;
  /** 1–3 catalog ids to fall back to when equipment/limitations exclude this. */
  subs: string[];
  /** Two sentences: what to do, what to avoid. */
  cue: string;
};

export function demoSearchUrl(name: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} exercise form`)}`;
}

const e = (
  id: string, name: string, pattern: MovementPattern,
  primary: BodyRegion[], secondary: BodyRegion[], equipment: EquipmentItem[],
  difficulty: 1 | 2 | 3, subs: string[], cue: string,
  flags: { unilateral?: boolean; compound?: boolean } = {},
): CatalogExercise => ({ id, name, pattern, primary, secondary, equipment, difficulty, subs, cue, ...flags });

export const CATALOG: readonly CatalogExercise[] = [
  // ── SQUAT ─────────────────────────────────────────────────────────────
  e('bb-back-squat', 'Barbell back squat', 'squat', ['quads', 'glutes'], ['core', 'hamstrings'], ['barbell', 'rack'], 3, ['goblet-squat', 'db-squat', 'air-squat'], 'Bar on the upper back, brace, sit down between your hips and drive up through the whole foot. Avoid letting the knees cave in or the heels lift.', { compound: true }),
  e('bb-front-squat', 'Barbell front squat', 'squat', ['quads', 'core'], ['glutes'], ['barbell', 'rack'], 3, ['goblet-squat', 'kb-front-squat'], 'Bar racked on the front delts, elbows high, squat tall. Avoid dropping the elbows — the bar follows them down.', { compound: true }),
  e('leg-press', 'Leg press', 'squat', ['quads', 'glutes'], ['hamstrings'], ['machine'], 1, ['goblet-squat', 'air-squat'], 'Feet mid-platform, lower under control to a deep but comfortable range, press without locking out hard. Avoid letting the lower back curl off the pad at the bottom.', { compound: true }),
  e('hack-squat', 'Hack squat', 'squat', ['quads'], ['glutes'], ['machine'], 2, ['leg-press', 'goblet-squat'], 'Back flat on the pad, lower slow, drive through mid-foot. Avoid bouncing out of the bottom.', { compound: true }),
  e('goblet-squat', 'Goblet squat', 'squat', ['quads', 'glutes'], ['core'], ['dumbbell'], 1, ['air-squat', 'kb-front-squat', 'band-squat'], 'Hold a dumbbell close to your chest and perform squats.¹ Avoid letting the weight pull you forward onto your toes.', { compound: true }),
  e('db-squat', 'Dumbbell squat', 'squat', ['quads', 'glutes'], ['core'], ['dumbbell'], 1, ['goblet-squat', 'air-squat'], 'A dumbbell in each hand at your sides, squat between them. Avoid rounding the upper back to reach depth.', { compound: true }),
  e('db-lunge', 'Dumbbell lunge', 'squat', ['quads', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 2, ['bw-reverse-lunge', 'split-squat'], 'Step forward or backward with one leg while holding dumbbells.¹ Avoid letting the front knee wander past the toes with the heel lifting.', { unilateral: true, compound: true }),
  e('db-step-up', 'Dumbbell step-up', 'squat', ['quads', 'glutes'], ['calves'], ['dumbbell', 'bench'], 2, ['bw-step-up', 'db-lunge'], 'Step onto a bench with one foot, alternating between legs.¹ Avoid pushing off the trailing foot — the top leg does the work.', { unilateral: true, compound: true }),
  e('bulgarian-split-squat', 'Bulgarian split squat', 'squat', ['quads', 'glutes'], ['hamstrings'], ['dumbbell', 'bench'], 3, ['split-squat', 'db-lunge'], 'Rear foot on the bench behind you, lower the back knee straight down. Avoid leaning so far forward it becomes a balance act.', { unilateral: true, compound: true }),
  e('kb-front-squat', 'Kettlebell front squat', 'squat', ['quads', 'glutes'], ['core'], ['kettlebell'], 2, ['goblet-squat', 'air-squat'], 'Bell racked at the chest, elbows tucked, squat tall. Avoid letting the bell drag the shoulders into a slump.', { compound: true }),
  e('band-squat', 'Band squat', 'squat', ['quads', 'glutes'], [], ['bands'], 1, ['air-squat'], 'Stand on the band, hold the top at the shoulders, squat against it. Avoid letting the band yank you forward out of the bottom.', { compound: true }),
  e('band-split-squat', 'Band split squat', 'squat', ['quads', 'glutes'], [], ['bands'], 2, ['split-squat'], 'Front foot on the band, handles at the shoulders, lunge pattern in place. Avoid a short back-foot stance that turns it into a wobble.', { unilateral: true, compound: true }),
  e('air-squat', 'Bodyweight squat', 'squat', ['quads', 'glutes'], ['core'], [], 1, ['split-squat', 'wall-sit'], 'Feet shoulder-width, sit down between your hips, stand tall. Avoid caving knees and heels leaving the floor.', { compound: true }),
  e('split-squat', 'Split squat', 'squat', ['quads', 'glutes'], ['hamstrings'], [], 1, ['bw-reverse-lunge', 'air-squat'], 'A long stance, lower the back knee toward the floor, drive up through the front foot. Avoid bouncing the back knee off the ground.', { unilateral: true, compound: true }),
  e('bw-reverse-lunge', 'Reverse lunge', 'squat', ['quads', 'glutes'], ['hamstrings'], [], 1, ['split-squat', 'air-squat'], 'Step back, lower the back knee, push through the front heel to stand. Avoid slamming the back knee down.', { unilateral: true, compound: true }),
  e('bw-step-up', 'Step-up', 'squat', ['quads', 'glutes'], ['calves'], ['bench'], 1, ['split-squat', 'air-squat'], 'Step onto a sturdy knee-height surface, stand fully, step down under control. Avoid launching off the bottom foot.', { unilateral: true, compound: true }),
  e('pistol-box', 'Box pistol squat', 'squat', ['quads', 'glutes'], ['core'], ['bench'], 3, ['split-squat', 'bw-step-up'], 'One leg, sit back to a box, stand without the other foot touching. Avoid dropping onto the box instead of lowering to it.', { unilateral: true, compound: true }),
  e('wall-sit', 'Wall sit', 'squat', ['quads'], ['glutes'], [], 1, ['air-squat'], 'Back flat on a wall, thighs parallel to the floor, hold. Avoid resting hands on the thighs — it unloads the point of the thing.'),

  // ── HINGE ─────────────────────────────────────────────────────────────
  e('bb-deadlift', 'Barbell deadlift', 'hinge', ['hamstrings', 'glutes', 'back'], ['core', 'quads'], ['barbell'], 3, ['db-deadlift', 'kb-deadlift', 'glute-bridge'], 'Bar over mid-foot, hinge to grip, push the floor away and stand tall. Avoid letting the hips shoot up first and turning it into a stiff-leg pull.', { compound: true }),
  e('bb-rdl', 'Barbell Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], ['back'], ['barbell'], 2, ['db-rdl', 'kb-rdl', 'glute-bridge'], 'Soft knees, push the hips back until the hamstrings pull, stand by squeezing the glutes. Avoid rounding the lower back to chase depth.', { compound: true }),
  e('bb-hip-thrust', 'Barbell hip thrust', 'hinge', ['glutes'], ['hamstrings'], ['barbell', 'bench'], 2, ['db-hip-thrust', 'glute-bridge'], 'Upper back on the bench, bar over the hips, drive to a straight line and pause. Avoid overarching the lower back at the top.', { compound: true }),
  e('db-deadlift', 'Dumbbell deadlift', 'hinge', ['hamstrings', 'glutes'], ['back', 'core'], ['dumbbell'], 1, ['kb-deadlift', 'glute-bridge'], 'Dumbbells at your sides, hinge down keeping them close to the legs, stand tall. Avoid squatting it — hips back, not down.', { compound: true }),
  e('db-rdl', 'Dumbbell Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], ['back'], ['dumbbell'], 1, ['kb-rdl', 'single-leg-rdl-bw'], 'Dumbbells slide down the thighs as the hips travel back, then stand. Avoid bending the knees more to touch lower.', { compound: true }),
  e('db-hip-thrust', 'Dumbbell hip thrust', 'hinge', ['glutes'], ['hamstrings'], ['dumbbell', 'bench'], 1, ['glute-bridge'], 'Dumbbell across the hips, shoulders on the bench, drive up and squeeze. Avoid pushing through the toes — heels down.', { compound: true }),
  e('kb-swing', 'Kettlebell swing', 'hinge', ['glutes', 'hamstrings'], ['core', 'back'], ['kettlebell'], 2, ['kb-rdl', 'glute-bridge'], 'Hike the bell back and snap the hips forward — the arms are just rope. Avoid lifting with the shoulders or squatting the swing.', { compound: true }),
  e('kb-deadlift', 'Kettlebell deadlift', 'hinge', ['hamstrings', 'glutes'], ['back'], ['kettlebell'], 1, ['db-deadlift', 'glute-bridge'], 'Bell between the feet, hinge, grip, stand tall. Avoid rounding down to it — hinge, then reach.', { compound: true }),
  e('kb-rdl', 'Kettlebell Romanian deadlift', 'hinge', ['hamstrings', 'glutes'], [], ['kettlebell'], 1, ['db-rdl', 'single-leg-rdl-bw'], 'Bell in both hands, hips back, slide it down the thighs. Avoid turning it into a squat.', { compound: true }),
  e('kb-single-leg-rdl', 'Kettlebell single-leg RDL', 'hinge', ['hamstrings', 'glutes'], ['core'], ['kettlebell'], 3, ['single-leg-rdl-bw', 'kb-rdl'], 'One leg planted, hinge as the other leg travels back, bell hangs under the shoulder. Avoid opening the hips sideways.', { unilateral: true, compound: true }),
  e('band-pull-through', 'Band pull-through', 'hinge', ['glutes', 'hamstrings'], [], ['bands'], 1, ['glute-bridge'], 'Band anchored low behind you, hinge and let it pull, then stand and squeeze. Avoid yanking with the arms.', { compound: true }),
  e('band-good-morning', 'Band good morning', 'hinge', ['hamstrings', 'glutes'], ['back'], ['bands'], 1, ['band-pull-through', 'glute-bridge'], 'Band over the shoulders and under the feet, hinge against it. Avoid rounding as the band loads up.', { compound: true }),
  e('glute-bridge', 'Glute bridge', 'hinge', ['glutes'], ['hamstrings'], [], 1, ['single-leg-glute-bridge'], 'On your back, heels close, drive the hips to a straight line and squeeze. Avoid pushing the arch into overextension.', { compound: true }),
  e('single-leg-glute-bridge', 'Single-leg glute bridge', 'hinge', ['glutes'], ['hamstrings'], [], 2, ['glute-bridge'], 'One foot down, the other leg held straight, bridge up level. Avoid letting the free-side hip sag.', { unilateral: true }),
  e('single-leg-rdl-bw', 'Single-leg RDL (bodyweight)', 'hinge', ['hamstrings', 'glutes'], ['core'], [], 2, ['glute-bridge'], 'Hinge on one leg, arms reaching, back leg counterbalancing. Avoid rushing — slow is the exercise.', { unilateral: true }),

  // ── PUSH-H ────────────────────────────────────────────────────────────
  e('bb-bench', 'Bench press (with barbell)', 'push-h', ['chest'], ['shoulders', 'arms'], ['barbell', 'bench', 'rack'], 2, ['db-bench', 'floor-press', 'push-up'], 'Using a barbell, perform the classic bench press on a flat bench.¹ Avoid bouncing the bar off the chest or letting the wrists roll back.', { compound: true }),
  e('bb-close-grip-bench', 'Close-grip bench press', 'push-h', ['arms', 'chest'], ['shoulders'], ['barbell', 'bench', 'rack'], 2, ['diamond-push-up', 'db-bench'], 'Hands just inside shoulder width, elbows tucked, press. Avoid flaring the elbows wide — that is the normal bench.', { compound: true }),
  e('db-bench', 'Flat bench dumbbell press', 'push-h', ['chest'], ['shoulders', 'arms'], ['dumbbell', 'bench'], 2, ['floor-press', 'push-up'], 'Lie on a flat bench with a dumbbell in each hand, press them up to the ceiling.¹ Avoid letting the dumbbells drift apart or clang together at the top.', { compound: true }),
  e('db-incline-press', 'Incline dumbbell press', 'push-h', ['chest', 'shoulders'], ['arms'], ['dumbbell', 'bench'], 2, ['db-bench', 'pike-push-up'], 'Similar to flat bench press but on an incline bench, targeting the upper chest.¹ Avoid setting the incline so steep it becomes a shoulder press.', { compound: true }),
  e('db-decline-press', 'Decline dumbbell press', 'push-h', ['chest'], ['arms'], ['dumbbell', 'bench'], 2, ['db-bench', 'push-up'], 'Lie on a decline bench to emphasize the lower chest.¹ Avoid short half-reps — full range still applies on a decline.', { compound: true }),
  e('db-flyes', 'Dumbbell flyes', 'push-h', ['chest'], ['shoulders'], ['dumbbell', 'bench'], 2, ['band-fly', 'push-up'], 'Lie on a flat bench, arms extended, and open and close the arms in a flye motion.¹ Avoid dropping so deep the shoulders complain — a gentle stretch is the bottom.'),
  e('floor-press', 'Dumbbell floor press', 'push-h', ['chest', 'arms'], ['shoulders'], ['dumbbell'], 1, ['push-up', 'band-chest-press'], 'On your back on the floor, press the dumbbells from triceps-on-ground to lockout. Avoid bouncing the elbows off the floor.', { compound: true }),
  e('kb-floor-press', 'Kettlebell floor press', 'push-h', ['chest', 'arms'], ['shoulders'], ['kettlebell'], 1, ['floor-press', 'push-up'], 'Bell racked on the forearm, press from the floor. Avoid letting the bell pull the wrist into a bend.', { compound: true }),
  e('band-chest-press', 'Band chest press', 'push-h', ['chest'], ['shoulders', 'arms'], ['bands'], 1, ['band-push-up', 'push-up'], 'Band around the upper back, press both handles forward. Avoid letting the band drag the shoulders forward at the stretch.', { compound: true }),
  e('band-push-up', 'Band-resisted push-up', 'push-h', ['chest'], ['arms', 'core'], ['bands'], 2, ['push-up'], 'Band across the back and under the palms, push up against it. Avoid the hips sagging as the band loads.', { compound: true }),
  e('band-fly', 'Band fly', 'push-h', ['chest'], [], ['bands'], 1, ['band-chest-press'], 'Band anchored behind, arms sweep together in an arc. Avoid bending the elbows into a press.'),
  e('push-up', 'Push-up', 'push-h', ['chest'], ['arms', 'shoulders', 'core'], [], 1, ['incline-push-up', 'knee-push-up'], 'A straight line from head to heels, chest to the floor, press away. Avoid sagging hips and flared elbows.', { compound: true }),
  e('incline-push-up', 'Incline push-up', 'push-h', ['chest'], ['arms', 'shoulders'], [], 1, ['knee-push-up'], 'Hands on a raised edge, body straight, press. Avoid shrugging the shoulders toward the ears.', { compound: true }),
  e('knee-push-up', 'Knee push-up', 'push-h', ['chest'], ['arms'], [], 1, ['incline-push-up'], 'Push-up pattern from the knees, hips locked in line. Avoid piking at the hips.', { compound: true }),
  e('decline-push-up', 'Decline push-up', 'push-h', ['chest', 'shoulders'], ['arms', 'core'], [], 2, ['push-up'], 'Feet raised, hands on the floor, press. Avoid letting the head lead — chest first.', { compound: true }),
  e('diamond-push-up', 'Diamond push-up', 'push-h', ['arms', 'chest'], ['core'], [], 2, ['push-up', 'bench-dips'], 'Hands close under the chest, elbows brushing the ribs. Avoid letting the elbows wing outward.', { compound: true }),
  e('bench-dips', 'Tricep dips (using a bench)', 'push-h', ['arms'], ['chest', 'shoulders'], ['bench'], 1, ['diamond-push-up', 'knee-push-up'], 'Place your hands on a bench, lower and lift your body to work the triceps.¹ Avoid sinking so low the front of the shoulders pinches.', { compound: true }),

  // ── PUSH-V ────────────────────────────────────────────────────────────
  e('bb-ohp', 'Barbell overhead press', 'push-v', ['shoulders'], ['arms', 'core'], ['barbell', 'rack'], 3, ['db-shoulder-press', 'pike-push-up'], 'Bar at the collarbones, brace, press to lockout overhead. Avoid leaning back into a standing incline bench.', { compound: true }),
  e('db-shoulder-press', 'Dumbbell shoulder press', 'push-v', ['shoulders'], ['arms'], ['dumbbell'], 1, ['band-ohp', 'pike-push-up'], 'Sit or stand, press dumbbells overhead, extending your arms.¹ Avoid arching the lower back to finish the rep.', { compound: true }),
  e('arnold-press', 'Arnold press', 'push-v', ['shoulders'], ['arms'], ['dumbbell'], 2, ['db-shoulder-press'], 'Start palms facing you, rotate out as you press overhead. Avoid rushing the rotation — it is the point.', { compound: true }),
  e('kb-press', 'Kettlebell press', 'push-v', ['shoulders'], ['arms', 'core'], ['kettlebell'], 2, ['db-shoulder-press', 'pike-push-up'], 'Bell racked, brace, press overhead with the forearm vertical. Avoid letting the bell drag the arm sideways.', { compound: true }),
  e('band-ohp', 'Band overhead press', 'push-v', ['shoulders'], ['arms'], ['bands'], 1, ['pike-push-up'], 'Stand on the band, press the handles overhead. Avoid shrugging into the ears as the band stretches.', { compound: true }),
  e('pike-push-up', 'Pike push-up', 'push-v', ['shoulders'], ['arms', 'core'], [], 2, ['incline-push-up', 'push-up'], 'Hips high in a pike, lower the head toward the hands, press. Avoid drifting forward into a normal push-up.', { compound: true }),
  e('wall-hspu', 'Wall handstand push-up', 'push-v', ['shoulders'], ['arms', 'core'], [], 3, ['pike-push-up'], 'Feet on the wall, hands down, lower and press. Avoid holding your breath through the whole set.', { compound: true }),

  // ── PULL-H ────────────────────────────────────────────────────────────
  e('bb-row', 'Bent-over rows (with barbell)', 'pull-h', ['back'], ['arms', 'core'], ['barbell'], 2, ['db-row', 'band-row', 'inverted-row'], 'Similar to dumbbell rows but performed with a barbell.¹ Avoid heaving with the lower back — the hinge stays still, the elbows move.', { compound: true }),
  e('db-row', 'Dumbbell rows', 'pull-h', ['back'], ['arms'], ['dumbbell', 'bench'], 1, ['db-single-arm-row', 'band-row'], 'Place one knee and hand on a bench, lift a dumbbell with the opposite hand, pulling it towards your hip.¹ Avoid twisting the torso to lift higher.', { unilateral: true, compound: true }),
  e('db-single-arm-row', 'Single-arm dumbbell rows', 'pull-h', ['back'], ['arms'], ['dumbbell'], 1, ['db-row', 'band-row'], 'Stand and row a dumbbell with one arm, stabilizing yourself with the opposite hand on a bench.¹ Avoid shrugging the working shoulder to the ear.', { unilateral: true, compound: true }),
  e('chest-supported-row', 'Chest-supported dumbbell row', 'pull-h', ['back'], ['arms'], ['dumbbell', 'bench'], 2, ['db-row'], 'Chest on an incline bench, row both dumbbells to the hips. Avoid lifting the chest off the pad to cheat.', { compound: true }),
  e('kb-row', 'Kettlebell row', 'pull-h', ['back'], ['arms'], ['kettlebell'], 1, ['band-row', 'inverted-row'], 'Hinge, row the bell to the hip, lower slow. Avoid letting the torso rotate open.', { unilateral: true, compound: true }),
  e('cable-row', 'Seated cable row', 'pull-h', ['back'], ['arms'], ['cable'], 1, ['band-row', 'db-row'], 'Sit tall, pull the handle to the navel, squeeze the blades. Avoid rocking back and forth for momentum.', { compound: true }),
  e('band-row', 'Band row', 'pull-h', ['back'], ['arms'], ['bands'], 1, ['inverted-row'], 'Band anchored at chest height, pull the handles to the ribs. Avoid letting the shoulders roll forward on the return.', { compound: true }),
  e('face-pull-band', 'Band face pull', 'pull-h', ['shoulders', 'back'], [], ['bands'], 1, ['band-row'], 'Pull the band toward the face, elbows high, hands finishing by the ears. Avoid turning it into a row to the chest.'),
  e('inverted-row', 'Inverted row (bar or sturdy table)', 'pull-h', ['back'], ['arms', 'core'], [], 2, ['band-row', 'towel-row'], 'Hang under a bar or a sturdy table edge, body straight, pull the chest to it. Avoid sagging hips — it is a moving plank.', { compound: true }),
  e('towel-row', 'Doorway towel row', 'pull-h', ['back'], ['arms'], [], 1, ['inverted-row'], 'A towel around a door handle, lean back, row yourself upright. Avoid jerking — the door frame will tell you.', { compound: true }),

  // ── PULL-V ────────────────────────────────────────────────────────────
  e('pull-up', 'Pull-up', 'pull-v', ['back'], ['arms', 'core'], ['pullupbar'], 3, ['negative-pull-up', 'band-assisted-pull-up', 'band-pulldown'], 'Hang, pull the chin over the bar, lower under control. Avoid kipping unless you have chosen to train kipping.', { compound: true }),
  e('chin-up', 'Chin-up', 'pull-v', ['back', 'arms'], ['core'], ['pullupbar'], 3, ['negative-pull-up', 'band-assisted-pull-up'], 'Underhand grip, pull the chin over the bar. Avoid half reps at the top — chin OVER.', { compound: true }),
  e('negative-pull-up', 'Negative pull-up', 'pull-v', ['back'], ['arms'], ['pullupbar'], 2, ['band-assisted-pull-up', 'band-pulldown'], 'Jump or step to the top position, lower as slowly as you can. Avoid dropping the last third.', { compound: true }),
  e('band-assisted-pull-up', 'Band-assisted pull-up', 'pull-v', ['back'], ['arms'], ['pullupbar', 'bands'], 2, ['negative-pull-up', 'band-pulldown'], 'Band under a knee or foot, pull the chin over the bar. Avoid letting the band do the bottom half for free — stay tense.', { compound: true }),
  e('lat-pulldown', 'Lat pulldown', 'pull-v', ['back'], ['arms'], ['cable'], 1, ['band-pulldown', 'pull-up'], 'Pull the bar to the collarbones with the chest tall. Avoid leaning way back and turning it into a row.', { compound: true }),
  e('band-pulldown', 'Band pulldown', 'pull-v', ['back'], ['arms'], ['bands'], 1, ['prone-y-raise'], 'Band anchored high, kneel, pull the handles to the shoulders. Avoid shrugging up as you release.', { compound: true }),
  e('prone-y-raise', 'Prone Y raise', 'pull-v', ['back', 'shoulders'], [], [], 1, ['band-pulldown'], 'Face down, arms overhead in a Y, lift them off the floor and hold a beat. Avoid cranking the neck up — eyes down.'),

  // ── CARRY ─────────────────────────────────────────────────────────────
  e('farmers-walk-db', "Farmer's walk (dumbbells)", 'carry', ['core', 'back'], ['arms', 'glutes'], ['dumbbell'], 1, ['suitcase-carry-kb', 'bear-crawl'], 'Heavy dumbbells at your sides, walk tall with short quick steps. Avoid letting one shoulder dip — the load stays level.', { compound: true }),
  e('farmers-walk-kb', "Farmer's walk (kettlebells)", 'carry', ['core', 'back'], ['arms', 'glutes'], ['kettlebell'], 1, ['suitcase-carry-kb', 'bear-crawl'], 'A bell in each hand, walk tall. Avoid rushing — posture is the exercise.', { compound: true }),
  e('suitcase-carry-kb', 'Suitcase carry', 'carry', ['core'], ['back', 'glutes'], ['kettlebell'], 2, ['farmers-walk-db', 'band-suitcase-march'], 'One bell, one side, walk without leaning. Avoid letting the free-side ribs flare out.', { unilateral: true, compound: true }),
  e('overhead-carry-kb', 'Overhead carry', 'carry', ['shoulders', 'core'], ['back'], ['kettlebell'], 3, ['suitcase-carry-kb'], 'Bell locked out overhead, walk a straight line. Avoid the elbow bending as you tire — stop instead.', { unilateral: true, compound: true }),
  e('band-suitcase-march', 'Band suitcase march', 'carry', ['core'], ['glutes'], ['bands'], 1, ['bear-crawl'], 'Stand on one end of the band, hold the other at your side, march in place. Avoid tipping toward the loaded hand.', { unilateral: true }),
  e('bear-crawl', 'Bear crawl', 'carry', ['core', 'shoulders'], ['quads'], [], 1, ['dead-bug'], 'Hands and feet down, knees an inch off the floor, crawl forward slowly. Avoid the hips swaying side to side.', { compound: true }),

  // ── CORE ──────────────────────────────────────────────────────────────
  e('plank', 'Plank', 'core', ['core'], ['shoulders'], [], 1, ['knee-plank', 'dead-bug'], 'Elbows under the shoulders, one straight line, breathe. Avoid the hips creeping up or sagging down.'),
  e('knee-plank', 'Knee plank', 'core', ['core'], [], [], 1, ['dead-bug'], 'Plank from the knees, hips locked in line. Avoid resting into the shoulders.'),
  e('side-plank', 'Side plank', 'core', ['core'], ['shoulders'], [], 2, ['plank'], 'Elbow under the shoulder, hips stacked and lifted. Avoid letting the top shoulder roll forward.', { unilateral: true }),
  e('dead-bug', 'Dead bug', 'core', ['core'], [], [], 1, ['plank'], 'On your back, lower the opposite arm and leg without the lower back lifting. Avoid holding your breath — exhale as the limbs go.', { unilateral: true }),
  e('bird-dog', 'Bird dog', 'core', ['core', 'back'], ['glutes'], [], 1, ['dead-bug'], 'From all fours, reach the opposite arm and leg long, pause, return. Avoid arching to reach higher.', { unilateral: true }),
  e('hollow-hold', 'Hollow hold', 'core', ['core'], [], [], 2, ['dead-bug'], 'Lower back pressed to the floor, arms and legs hovering. Avoid the lower back peeling up — shorten the lever instead.'),
  e('mountain-climbers', 'Mountain climbers', 'core', ['core'], ['shoulders', 'quads'], [], 1, ['plank', 'bear-crawl'], 'From a push-up position, drive the knees in alternately. Avoid bouncing the hips skyward.'),
  e('hanging-knee-raise', 'Hanging knee raise', 'core', ['core'], ['arms'], ['pullupbar'], 2, ['dead-bug', 'hollow-hold'], 'Hang, lift the knees to the chest under control, lower slow. Avoid swinging into the next rep.'),
  e('pallof-press-band', 'Pallof press', 'core', ['core'], [], ['bands'], 1, ['side-plank', 'dead-bug'], 'Band anchored to the side, press it straight out and resist the twist. Avoid letting the hips rotate toward the anchor.', { unilateral: true }),
  e('cable-crunch', 'Cable crunch', 'core', ['core'], [], ['cable'], 1, ['hollow-hold'], 'Kneel, rope behind the head, crunch the ribs to the hips. Avoid pulling with the arms.'),
  e('russian-twist-db', 'Russian twist', 'core', ['core'], [], ['dumbbell'], 1, ['pallof-press-band', 'side-plank'], 'Seated, lean back, rotate the weight side to side with control. Avoid rounding into a slump — chest stays proud.'),
  e('kb-windmill', 'Kettlebell windmill', 'core', ['core', 'shoulders'], ['hamstrings'], ['kettlebell'], 3, ['side-plank'], 'Bell overhead, hinge sideways down the free leg, eyes on the bell. Avoid bending the loaded arm.', { unilateral: true }),
  e('ab-rollout-band', 'Band-anchored rollout', 'core', ['core'], ['shoulders'], ['bands'], 2, ['plank', 'hollow-hold'], 'Band behind you for assistance, roll or walk the hands out and back. Avoid the hips sagging at full reach.'),

  // ── ACCESSORIES ───────────────────────────────────────────────────────
  e('db-curl', 'Dumbbell bicep curls', 'accessory', ['arms'], [], ['dumbbell'], 1, ['band-curl'], 'Stand and curl the dumbbells, targeting the biceps.¹ Avoid swinging the hips to start the rep.'),
  e('bb-curl', 'Barbell curl', 'accessory', ['arms'], [], ['barbell'], 1, ['db-curl', 'band-curl'], 'Curl the bar with the elbows pinned to the ribs. Avoid leaning back as it rises.'),
  e('hammer-curl', 'Hammer curl', 'accessory', ['arms'], [], ['dumbbell'], 1, ['db-curl'], 'Neutral grip, curl without rotating. Avoid the elbows drifting forward.'),
  e('band-curl', 'Band curl', 'accessory', ['arms'], [], ['bands'], 1, ['db-curl'], 'Stand on the band, curl the handles. Avoid cutting the top short where the band is hardest.'),
  e('cable-pushdown', 'Cable pushdown', 'accessory', ['arms'], [], ['cable'], 1, ['band-pressdown', 'bench-dips'], 'Elbows pinned, press the handle down to lockout. Avoid letting the elbows flare on the way up.'),
  e('band-pressdown', 'Band pressdown', 'accessory', ['arms'], [], ['bands'], 1, ['bench-dips', 'diamond-push-up'], 'Band anchored high, press down to lockout. Avoid leaning your weight onto the band.'),
  e('overhead-db-extension', 'Overhead dumbbell extension', 'accessory', ['arms'], [], ['dumbbell'], 1, ['band-pressdown', 'diamond-push-up'], 'Both hands under one dumbbell overhead, lower behind the head, extend. Avoid flaring the elbows wide.'),
  e('skullcrusher', 'Skullcrusher', 'accessory', ['arms'], [], ['barbell', 'bench'], 2, ['overhead-db-extension', 'diamond-push-up'], 'Lower the bar to the forehead with still elbows, extend. Avoid turning it into a strange press by moving the shoulders.'),
  e('lateral-raise', 'Lateral raises', 'accessory', ['shoulders'], [], ['dumbbell'], 1, ['band-lateral-raise'], 'Stand and lift dumbbells to the sides, targeting the lateral deltoids.¹ Avoid shrugging — lead with the elbows, not the traps.'),
  e('band-lateral-raise', 'Band lateral raise', 'accessory', ['shoulders'], [], ['bands'], 1, ['lateral-raise'], 'Stand on the band, raise the handles to the sides. Avoid raising past shoulder height.'),
  e('rear-delt-fly', 'Rear delt fly', 'accessory', ['shoulders', 'back'], [], ['dumbbell'], 1, ['face-pull-band'], 'Hinge, arms hang, sweep the dumbbells wide. Avoid squeezing the blades so hard it becomes a row.'),
  e('cable-lateral-raise', 'Cable lateral raise', 'accessory', ['shoulders'], [], ['cable'], 1, ['lateral-raise', 'band-lateral-raise'], 'Cable low at your side, raise the arm across the body line. Avoid leaning away to cheat the arc.', { unilateral: true }),
  e('db-shrug', 'Dumbbell shrug', 'accessory', ['back'], [], ['dumbbell'], 1, ['band-row'], 'Dumbbells at your sides, shrug straight up, pause. Avoid rolling the shoulders in circles.'),
  e('calf-raise-bw', 'Calf raise', 'accessory', ['calves'], [], [], 1, ['calf-raise-db'], 'Ball of the foot on an edge, rise tall, lower past level slowly. Avoid bouncing out of the stretch.'),
  e('calf-raise-db', 'Dumbbell calf raise', 'accessory', ['calves'], [], ['dumbbell'], 1, ['calf-raise-bw'], 'Hold dumbbells, rise onto the toes, pause at the top. Avoid short pulses — full range, slow bottom.'),
  e('seated-calf-machine', 'Seated calf raise', 'accessory', ['calves'], [], ['machine'], 1, ['calf-raise-db', 'calf-raise-bw'], 'Pads on the knees, rise and lower through full range. Avoid racking the weight with a bounce.'),
  e('leg-extension', 'Leg extension', 'accessory', ['quads'], [], ['machine'], 1, ['wall-sit', 'air-squat'], 'Extend to straight, pause, lower slow. Avoid slamming into the stack between reps.'),
  e('leg-curl', 'Leg curl', 'accessory', ['hamstrings'], [], ['machine'], 1, ['single-leg-rdl-bw', 'glute-bridge'], 'Curl the pad to the glutes, lower slow. Avoid lifting the hips off the pad.'),
  e('nordic-curl', 'Nordic curl (assisted)', 'accessory', ['hamstrings'], ['glutes'], [], 3, ['single-leg-rdl-bw', 'glute-bridge'], 'Ankles anchored, lower forward as slowly as possible, push back up. Avoid breaking at the hips — the line stays straight.'),
  e('cable-fly', 'Cable fly', 'accessory', ['chest'], [], ['cable'], 1, ['db-flyes', 'band-fly'], 'Arms sweep together in a hugging arc. Avoid pressing — elbows stay softly fixed.'),
  e('pec-deck', 'Pec deck', 'accessory', ['chest'], [], ['machine'], 1, ['cable-fly', 'band-fly'], 'Forearms or hands on the pads, squeeze together, open slow. Avoid letting the weight yank the shoulders open.'),
  e('straight-arm-pulldown', 'Straight-arm pulldown', 'accessory', ['back'], [], ['cable'], 1, ['band-pulldown'], 'Arms almost straight, sweep the bar to the thighs. Avoid bending the elbows into a pushdown.'),
  e('band-abduction', 'Band hip abduction', 'accessory', ['glutes'], [], ['bands'], 1, ['clamshell'], 'Band above the knees, press them apart against it. Avoid rocking the torso for extra range.'),
  e('clamshell', 'Clamshell', 'accessory', ['glutes'], [], [], 1, ['band-abduction', 'single-leg-glute-bridge'], 'Side-lying, heels together, open the top knee. Avoid rolling the hips backward as it opens.', { unilateral: true }),
  e('cable-kickback', 'Cable glute kickback', 'accessory', ['glutes'], ['hamstrings'], ['cable'], 1, ['single-leg-glute-bridge', 'band-abduction'], 'Cuff on the ankle, press the leg back and squeeze. Avoid arching the lower back to fake height.', { unilateral: true }),
  e('upright-row-db', 'Upright row', 'accessory', ['shoulders'], ['back'], ['dumbbell'], 2, ['lateral-raise'], 'Lift the dumbbells up the body line to chest height. Avoid pulling above the chest if the shoulders complain.'),
  e('db-pullover', 'Dumbbell pullover', 'accessory', ['chest', 'back'], [], ['dumbbell', 'bench'], 2, ['band-pulldown'], 'One dumbbell in both hands, lower it behind the head, sweep back over. Avoid bending the elbows more as it goes back.'),
  e('band-face-pull-high', 'High band face pull', 'accessory', ['shoulders', 'back'], [], ['bands'], 1, ['face-pull-band'], 'Anchor high, pull to the face with elbows up. Avoid finishing with the hands below the chin.'),
  e('db-lateral-lunge', 'Lateral lunge', 'accessory', ['quads', 'glutes'], ['hamstrings'], ['dumbbell'], 2, ['split-squat', 'air-squat'], 'Step wide sideways, sit into that hip, push back to standing. Avoid the trailing foot rolling inward.', { unilateral: true, compound: true }),
  e('kb-goblet-lunge', 'Kettlebell goblet lunge', 'accessory', ['quads', 'glutes'], ['core'], ['kettlebell'], 2, ['split-squat'], 'Bell at the chest, lunge pattern. Avoid the bell tipping you forward.', { unilateral: true, compound: true }),
] as const;

export const CATALOG_BY_ID: ReadonlyMap<string, CatalogExercise> = new Map(CATALOG.map((x) => [x.id, x]));

/** Everything doable with `available` (an exercise needs ALL its items). */
export function doableWith(available: ReadonlySet<EquipmentItem>): CatalogExercise[] {
  return CATALOG.filter((x) => x.equipment.every((eq) => available.has(eq)));
}
