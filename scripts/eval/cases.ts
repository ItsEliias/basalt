// ai-quick-add eval cases. Each case pins an item-count band and a
// GENEROUS true-energy band — the harness checks the model's point lands
// inside it, and (V3 graded uncertainty) that the model's own low–high
// range CONTAINS the true band's centre and is internally coherent
// (low < point < high). Range honesty beats range tightness: a true value
// inside the range scores; a tight wrong range fails.
//
// The bands are deliberately wide — this is an honesty harness, not a
// nutrition database. Recalibrate a band only with a source you can cite.

export type EvalCase = {
  id: string;
  description: string;
  /** Inclusive item-count band. */
  items: [number, number];
  /** Generous total-kcal band across all items. */
  kcal: [number, number];
  /** Substrings expected somewhere in portion notes / note (lowercased). */
  expectNote?: string[];
  /** Expect at least one omission suggestion mentioning one of these. */
  expectOmissionOneOf?: string[];
};

export const CASES: EvalCase[] = [
  { id: 'eggs-toast', description: '2 eggs, rye toast and a long black', items: [2, 3], kcal: [200, 420], expectOmissionOneOf: ['butter', 'oil', 'milk', 'sugar'] },
  { id: 'banana', description: 'a banana', items: [1, 1], kcal: [70, 140] },
  { id: 'timtam', description: 'one Tim Tam', items: [1, 1], kcal: [80, 120] },
  { id: 'flat-white', description: 'flat white with full cream milk', items: [1, 1], kcal: [90, 190] },
  { id: 'chicken-rice', description: '200g grilled chicken breast with a cup of white rice', items: [2, 2], kcal: [420, 650], expectOmissionOneOf: ['oil'] },
  { id: 'big-curry', description: 'a big bowl of butter chicken with rice and naan', items: [2, 3], kcal: [700, 1400] },
  { id: 'salad', description: 'caesar salad', items: [1, 2], kcal: [250, 700], expectOmissionOneOf: ['dressing'] },
  { id: 'smoothie', description: 'banana and peanut butter smoothie with milk', items: [1, 1], kcal: [250, 550] },
  { id: 'oats', description: 'overnight oats with yoghurt and berries', items: [1, 2], kcal: [250, 550] },
  { id: 'pizza', description: '3 slices of pepperoni pizza', items: [1, 1], kcal: [550, 1000] },
  { id: 'stirfry', description: 'beef and vegetable stir fry, pan cooked', items: [1, 2], kcal: [350, 800], expectOmissionOneOf: ['oil'] },
  { id: 'protein-shake', description: 'protein shake, one scoop in water', items: [1, 1], kcal: [90, 180] },
  { id: 'avo-toast', description: 'avocado on two slices of sourdough', items: [1, 2], kcal: [280, 550] },
  { id: 'meat-pie', description: 'a meat pie from the servo', items: [1, 1], kcal: [350, 550] },
  { id: 'sushi', description: '8 pieces of salmon sushi', items: [1, 1], kcal: [250, 500] },
  { id: 'pasta', description: 'spaghetti bolognese, restaurant serve', items: [1, 2], kcal: [550, 1100] },
  { id: 'yoghurt', description: 'small tub of greek yoghurt with honey', items: [1, 2], kcal: [120, 320], expectOmissionOneOf: [] },
  { id: 'burger-chips', description: 'cheeseburger and medium chips', items: [2, 2], kcal: [650, 1100] },
  { id: 'apple-pb', description: 'apple with a tablespoon of peanut butter', items: [1, 2], kcal: [140, 260] }, // USDA: medium apple ~95 + 16g PB ~96 → ~191
  { id: 'wine', description: 'two glasses of red wine', items: [1, 1], kcal: [200, 340] },
];
