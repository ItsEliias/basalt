// @basalt/nutrition — food/water logging core, Open Food Facts client,
// recipe-import client. Moved from the app's food/water/OFF/recipe-import
// services per PHASE0_EXTRACTION_PLAN.md E8. Reward-system side-effects
// (XP, character/pet progression, etc.) stay in the app-side service shims
// that call into this package.
export * from './food';
export * from './water';
export * from './open-food-facts';
export * from './recipe-import';
export * from './targets';
export * from './hydration-goal';
export * from './gs1';
export * from './favorites';
export * from './recipes';
export * from './grocery';
export * from './planner';
export * from './reconcile';
export * from './photos';
