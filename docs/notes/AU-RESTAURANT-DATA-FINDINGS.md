# AU restaurant menu data — findings (NOT built, by V3 instruction)

What exists, what it costs, and why nothing shipped.

## The landscape

- **No open AU menu-nutrition dataset exists.** FSANZ's AFCD covers generic foods
  (already reachable through OFF's generic entries), not branded restaurant menus.
- **Large chains publish per-item nutrition** (McDonald's AU, KFC, Subway, Grill'd,
  Guzman y Gomez, Nando's) — but as PDFs/web pages with no API, each in a different
  format, each changing without notice. Scraping them means a maintenance treadmill and
  brittle numbers presented as fact — a direct honesty-law risk when a menu reformulates
  and our copy of it doesn't.
- **Commercial aggregators** (Nutritionix, Calorie King AU, FatSecret Platform) license
  branded-food databases with AU coverage of varying depth. All are paid, per-request or
  per-seat, and their AU restaurant coverage is thinner than US. No monetisation means
  no obvious way to absorb a per-request fee at scale.
- **kJ menu labelling law** (mandatory in most states for large chains) guarantees the
  *energy* number exists on the menu board itself — which the photo/label lane can
  already capture today: photograph the menu board, the label mode transcribes kJ and
  converts. This is the honest stopgap and it already works.

## What users can already do without a dataset

1. Photograph the menu board → label mode transcribes the printed kJ (kJ→kcal
   conversion is stated in the note).
2. Describe the meal → quick-add estimates with a range that widens for restaurant
   preparation (the prompt already treats "restaurant serve" as high-uncertainty).
3. Barcode any packaged sides via OFF.

## Recommendation

Do not scrape. If AU branded coverage becomes a priority, the defensible paths are
(a) a licensed aggregator behind an Edge Function with per-item source attribution and
a cache TTL matched to the license, or (b) chain-by-chain official data with a visible
"as published <date>" stamp and an update job. Both need a budget decision first;
neither is worth it while the photo-label lane covers the energy number for free.
