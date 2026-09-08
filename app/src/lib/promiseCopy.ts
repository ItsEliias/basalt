// The honest promise (V4 Phase 8g) — pure copy, no RN imports, so the
// pin test can read it. Rendered by components/PromiseScreen.tsx; the
// same substance lives in the store listing and the tester release notes.

export const PROMISE_TITLE = 'What Basalt does and doesn\u2019t do';

export const PROMISE_DOES = [
  'Builds your programme and meal plan from your own numbers \u2014 your equipment, your week, your history.',
  'Shows the maths behind every target, every suggestion, every adjustment. Nothing is a black box.',
  'Corrects itself weekly against your trend weight \u2014 one bounded change at a time, with the reason attached.',
] as const;

export const PROMISE_DOESNT = [
  'See your form. A phone can count sets; it cannot watch your spine.',
  'Tell muscle from fat on the scale. The trend is honest; its composition isn\u2019t knowable from here.',
  'Diagnose anything. Pain flags count; they never conclude.',
  'Replace a professional for injuries, eating disorders or medical conditions \u2014 those deserve a person.',
] as const;
