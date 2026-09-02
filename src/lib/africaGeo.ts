// Approximate placement of African countries on AfricaNetworkMap's
// hand-drawn continent silhouette (viewBox 0 0 600 620) — a stylized
// map position, not a GPS coordinate. Anchored against the 8 cities the
// component already shipped with (Cairo, Accra, Lagos, Douala, Kampala,
// Nairobi, Kigali, Cape Town) and interpolated for their neighbors, so
// a new country lands in roughly the right region of the silhouette
// instead of being scattered randomly. Deliberately NOT claiming
// precision — it exists only so real per-country data (e.g. builder
// counts from leaderboard_public.country) can be plotted somewhere
// geographically sane; a country not listed here just doesn't get a
// node rather than guessing.
export const COUNTRY_POSITIONS: Record<string, { x: number; y: number }> = {
  // North Africa
  Egypt: { x: 345, y: 105 },
  Libya: { x: 300, y: 110 },
  Tunisia: { x: 265, y: 75 },
  Algeria: { x: 200, y: 110 },
  Morocco: { x: 145, y: 105 },
  Sudan: { x: 355, y: 190 },
  'South Sudan': { x: 350, y: 260 },

  // West Africa
  Ghana: { x: 148, y: 318 },
  Nigeria: { x: 215, y: 345 },
  Senegal: { x: 90, y: 255 },
  Mali: { x: 145, y: 220 },
  Niger: { x: 210, y: 230 },
  'Burkina Faso': { x: 155, y: 260 },
  'Ivory Coast': { x: 130, y: 320 },
  "Côte d'Ivoire": { x: 130, y: 320 },
  Guinea: { x: 90, y: 290 },
  'Sierra Leone': { x: 75, y: 310 },
  Liberia: { x: 90, y: 335 },
  Togo: { x: 165, y: 325 },
  Benin: { x: 180, y: 330 },
  Gambia: { x: 75, y: 250 },
  'Guinea-Bissau': { x: 70, y: 280 },
  Mauritania: { x: 105, y: 180 },

  // Central Africa
  Cameroon: { x: 275, y: 368 },
  'DR Congo': { x: 320, y: 400 },
  'Democratic Republic of the Congo': { x: 320, y: 400 },
  Congo: { x: 285, y: 395 },
  Gabon: { x: 265, y: 400 },
  Chad: { x: 270, y: 220 },
  'Central African Republic': { x: 300, y: 300 },
  'Equatorial Guinea': { x: 258, y: 385 },

  // East Africa
  Uganda: { x: 378, y: 342 },
  Kenya: { x: 408, y: 362 },
  Rwanda: { x: 372, y: 388 },
  Tanzania: { x: 395, y: 410 },
  Ethiopia: { x: 405, y: 255 },
  Somalia: { x: 460, y: 300 },
  Burundi: { x: 368, y: 405 },
  Eritrea: { x: 400, y: 190 },
  Djibouti: { x: 425, y: 220 },

  // Southern Africa
  'South Africa': { x: 295, y: 565 },
  Zambia: { x: 335, y: 455 },
  Zimbabwe: { x: 335, y: 490 },
  Botswana: { x: 300, y: 500 },
  Namibia: { x: 260, y: 500 },
  Mozambique: { x: 370, y: 480 },
  Malawi: { x: 365, y: 440 },
  Angola: { x: 275, y: 450 },
  Lesotho: { x: 310, y: 545 },
  Eswatini: { x: 325, y: 535 },
  Madagascar: { x: 470, y: 470 },
}

export function positionFor(countryName: string | null | undefined): { x: number; y: number } | null {
  if (!countryName) return null
  return COUNTRY_POSITIONS[countryName.trim()] ?? null
}
