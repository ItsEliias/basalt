// Static pools the generators draw from — real-ish foods and a small lift
// roster. Kept separate from plan.ts so the day-by-day logic stays readable.

export type FoodTemplate = {
  name: string;
  brand?: string;
  barcode?: string;
  perServe: { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar?: number; sodiumMg?: number };
};

// A recurring pool (favorites build up real use_count) plus enough variety
// that 90 days doesn't read as an obvious 5-food loop.
export const BREAKFASTS: FoodTemplate[] = [
  { name: 'Oats & banana', perServe: { calories: 420, protein: 16, carbs: 68, fat: 9, fiber: 8, sugar: 18 } },
  { name: 'Greek yoghurt & berries', perServe: { calories: 310, protein: 28, carbs: 32, fat: 6, fiber: 5, sugar: 20 } },
  { name: 'Scrambled eggs & toast', perServe: { calories: 460, protein: 26, carbs: 34, fat: 22, fiber: 4, sodiumMg: 620 } },
  { name: "Uncle Tobys Oats", brand: 'Uncle Tobys', barcode: '9310072021015', perServe: { calories: 380, protein: 12, carbs: 62, fat: 7, fiber: 9 } },
  { name: 'Protein smoothie', perServe: { calories: 340, protein: 34, carbs: 38, fat: 5, fiber: 4, sugar: 22 } },
];

export const LUNCHES: FoodTemplate[] = [
  { name: 'Chicken & rice bowl', perServe: { calories: 610, protein: 48, carbs: 66, fat: 14, fiber: 5, sodiumMg: 540 } },
  { name: 'Tuna salad wrap', perServe: { calories: 480, protein: 34, carbs: 42, fat: 18, fiber: 6, sodiumMg: 780 } },
  { name: 'Beef & veg stir-fry', perServe: { calories: 560, protein: 40, carbs: 48, fat: 20, fiber: 7 } },
  { name: "Subway 6\" Chicken Teriyaki", brand: 'Subway', barcode: '9300633001123', perServe: { calories: 470, protein: 28, carbs: 62, fat: 10, fiber: 5, sodiumMg: 980 } },
  { name: 'Leftover pasta bake', perServe: { calories: 640, protein: 30, carbs: 78, fat: 22, fiber: 4, sodiumMg: 710 } },
];

export const DINNERS: FoodTemplate[] = [
  { name: 'Salmon, sweet potato & greens', perServe: { calories: 620, protein: 42, carbs: 48, fat: 26, fiber: 8 } },
  { name: 'Steak, rice & broccoli', perServe: { calories: 720, protein: 50, carbs: 58, fat: 28, fiber: 6 } },
  { name: 'Chicken curry & rice', perServe: { calories: 680, protein: 38, carbs: 74, fat: 22, fiber: 5, sodiumMg: 890 } },
  { name: 'Homemade burgers', perServe: { calories: 780, protein: 42, carbs: 56, fat: 40, fiber: 4, sodiumMg: 920 } },
  { name: "Lean Cuisine Butter Chicken", brand: 'Lean Cuisine', barcode: '9300605012349', perServe: { calories: 410, protein: 24, carbs: 48, fat: 12, fiber: 4, sodiumMg: 760 } },
];

export const SNACKS: FoodTemplate[] = [
  { name: 'Protein bar', brand: 'Musashi', barcode: '9310488001234', perServe: { calories: 220, protein: 20, carbs: 20, fat: 7, fiber: 3, sugar: 4 } },
  { name: 'Apple & peanut butter', perServe: { calories: 260, protein: 7, carbs: 28, fat: 14, fiber: 5, sugar: 18 } },
  { name: 'Mixed nuts', perServe: { calories: 300, protein: 10, carbs: 10, fat: 26, fiber: 4 } },
  { name: 'Rice cakes & cottage cheese', perServe: { calories: 190, protein: 14, carbs: 22, fat: 3, fiber: 2 } },
];

// AI-photo-capture style entries — plausible but visibly estimate-shaped
// (round numbers), matching how a vision estimate would land before the
// user nudges it.
export const AI_PHOTO_MEALS: FoodTemplate[] = [
  { name: 'Café brunch plate (estimated)', perServe: { calories: 650, protein: 25, carbs: 55, fat: 35, fiber: 4 } },
  { name: 'Takeaway pad thai (estimated)', perServe: { calories: 700, protein: 28, carbs: 90, fat: 22, fiber: 3 } },
  { name: 'Restaurant pizza slice x2 (estimated)', perServe: { calories: 560, protein: 22, carbs: 64, fat: 24, fiber: 3 } },
];

// Health-Connect-style auto-logged entries — a smartwatch nutrition app
// pushing a coarse estimate, package name carried through as dataOrigin.
export const HC_MEALS: FoodTemplate[] = [
  { name: 'Logged meal', perServe: { calories: 520, protein: 25, carbs: 55, fat: 18, fiber: 4 } },
  { name: 'Logged snack', perServe: { calories: 240, protein: 10, carbs: 28, fat: 9, fiber: 2 } },
];

export const HC_DATA_ORIGINS = ['com.sec.android.app.shealth', 'com.myfitnesspal.android'];

// The lift roster — names verified to exist verbatim in basalt_exercises
// (select name from basalt_exercises where name ilike …) before writing this
// list, so exercise_id resolution at seed time never silently falls back to
// a null id.
export const MAIN_LIFTS: Record<'push' | 'pull' | 'legs' | 'upper' | 'lower', { name: string; startKg: number; reps: number }[]> = {
  push: [
    { name: 'Barbell Bench Press - Medium Grip', startKg: 60, reps: 6 },
    { name: 'Seated Dumbbell Press', startKg: 18, reps: 8 },
    { name: 'Triceps Pushdown', startKg: 25, reps: 10 },
  ],
  pull: [
    { name: 'Barbell Deadlift', startKg: 90, reps: 5 },
    { name: 'Wide-Grip Lat Pulldown', startKg: 50, reps: 8 },
    { name: 'Seated Cable Rows', startKg: 45, reps: 10 },
  ],
  legs: [
    { name: 'Barbell Squat', startKg: 75, reps: 6 },
    { name: 'Leg Press', startKg: 120, reps: 10 },
    { name: 'Standing Calf Raises', startKg: 40, reps: 12 },
  ],
  upper: [
    { name: 'Incline Dumbbell Press', startKg: 22, reps: 8 },
    { name: 'Pullups', startKg: 0, reps: 8 },
    { name: 'Arnold Dumbbell Press', startKg: 16, reps: 10 },
  ],
  lower: [
    { name: 'Barbell Full Squat', startKg: 70, reps: 8 },
    { name: 'Romanian Deadlift', startKg: 65, reps: 8 },
    { name: 'Barbell Walking Lunge', startKg: 14, reps: 10 },
  ],
};

export const MINDFULNESS_KINDS = ['box', '478', 'coherent', 'unguided'] as const;
