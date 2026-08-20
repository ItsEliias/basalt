import { listWeightEntries, saveTargets, type ProfileRecord } from '@basalt/core-data';
import { computeTargets, type GoalKey, type TargetInput } from '@basalt/nutrition';
import { supabase } from './supabase';

// Recompute the versioned targets from the current profile + latest weight.
// Returns false (with no write) when the essentials are missing — an honest
// absence beats a guessed target.

export async function recomputeTargetsFromProfile(profile: ProfileRecord): Promise<boolean> {
  const weights = await listWeightEntries(supabase, 365);
  const latest = weights.ok && weights.data.length > 0 ? weights.data[weights.data.length - 1] : null;

  if (!profile.ageYears || !profile.heightCm || !latest || !profile.biologicalSex) return false;

  const input: TargetInput = {
    biologicalSex: profile.biologicalSex,
    age: profile.ageYears,
    heightCm: profile.heightCm,
    weightKg: latest.weightKg,
    activityLevel: profile.activityLevel ?? 'sedentary',
    goals: (profile.goalTypes ?? []) as GoalKey[],
    dietPatterns: profile.dietPatterns,
    jobActivity: (profile.jobActivity ?? undefined) as TargetInput['jobActivity'],
  };
  const t = computeTargets(input);
  const saved = await saveTargets(supabase, {
    calories: t.calories, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG,
    fiberG: t.fiberG, sugarCapG: t.sugarCapG, sodiumCapMg: t.sodiumCapMg,
    waterMl: t.waterMl, steps: t.steps, sleepMin: t.sleepMin,
    reason: `Profile updated — ${t.explanation}`,
  });
  return saved.ok;
}
