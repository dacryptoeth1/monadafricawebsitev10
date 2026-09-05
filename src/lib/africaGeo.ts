// Where each African country sits on the Monad Africa network-map brand
// asset (public/brand/africa-network-map-purple.webp), which is what
// AfricaNetworkMap now actually draws — the map used to be a crude
// hand-drawn silhouette, and every position here was hand-tuned against
// that silhouette rather than against anything geographic.
//
// The brand artwork is an essentially plate-carrée (equirectangular)
// rendering of the continent, so positions are no longer hand-tuned at
// all: they're a real latitude/longitude run through the projection
// fitted to the artwork below. That means a country lands where it
// actually is on the picture, and adding another one only takes its
// coordinates — no eyeballing.
//
// The fit was measured from the asset itself (699x440) against four
// widely-separated landmarks on its own coastline: the Cap-Vert
// peninsula, the Horn of Somalia, the Mediterranean coast, and Cape
// Agulhas. Coordinates are country centroids (or, for the small coastal
// states where a centroid would sit in the sea, their capital) — a
// country-level marker, not a claim about where any individual builder
// lives.

/** Natural size of the brand map asset — also AfricaNetworkMap's viewBox. */
export const MAP_WIDTH = 699
export const MAP_HEIGHT = 440

// x = LON_ORIGIN + lon * LON_SCALE ; y = LAT_ORIGIN - lat * LAT_SCALE
const LON_ORIGIN = 248.6
const LON_SCALE = 5.806
const LAT_ORIGIN = 223.2
const LAT_SCALE = 6.0

/** Projects real [latitude, longitude] onto the brand map's pixel space. */
export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: Math.round((LON_ORIGIN + lon * LON_SCALE) * 10) / 10,
    y: Math.round((LAT_ORIGIN - lat * LAT_SCALE) * 10) / 10,
  }
}

// [latitude, longitude]. Two spellings are listed for the countries
// whose name varies between data sources (Ivory Coast / Côte d'Ivoire,
// DR Congo / Democratic Republic of the Congo) so either form stored on
// a profile resolves — same convention as countryFlag.ts.
const COUNTRY_LATLON: Record<string, [number, number]> = {
  // North Africa
  Egypt: [26.8, 30.8],
  Libya: [26.3, 17.2],
  Tunisia: [34.0, 9.6],
  Algeria: [28.0, 2.6],
  Morocco: [31.8, -6.5],
  Sudan: [15.6, 30.2],
  'South Sudan': [7.3, 30.3],
  Mauritania: [20.0, -10.5],
  Mali: [17.0, -3.5],
  Niger: [17.0, 8.0],
  Chad: [15.0, 18.5],

  // West Africa
  Nigeria: [9.1, 8.7],
  Ghana: [7.9, -1.0],
  Senegal: [14.5, -14.5],
  'Burkina Faso': [12.3, -1.6],
  'Ivory Coast': [7.5, -5.5],
  "Côte d'Ivoire": [7.5, -5.5],
  Guinea: [10.4, -10.9],
  'Sierra Leone': [8.5, -11.8],
  Liberia: [6.4, -9.4],
  Togo: [8.6, 0.9],
  Benin: [9.3, 2.3],
  Gambia: [13.45, -15.4],
  'Guinea-Bissau': [12.0, -15.0],
  'Cape Verde': [15.1, -23.6],

  // Central Africa
  Cameroon: [5.7, 12.4],
  'DR Congo': [-2.9, 23.6],
  'Democratic Republic of the Congo': [-2.9, 23.6],
  Congo: [-0.7, 15.8],
  Gabon: [-0.8, 11.6],
  'Central African Republic': [6.6, 20.9],
  'Equatorial Guinea': [1.6, 10.5],
  'Sao Tome and Principe': [0.3, 6.6],

  // East Africa
  Uganda: [1.4, 32.3],
  Kenya: [0.2, 37.9],
  Rwanda: [-1.9, 29.9],
  Burundi: [-3.4, 29.9],
  Tanzania: [-6.4, 34.9],
  Ethiopia: [9.1, 40.5],
  Somalia: [5.2, 46.2],
  Eritrea: [15.2, 39.8],
  Djibouti: [11.8, 42.6],
  Comoros: [-11.6, 43.3],
  Seychelles: [-4.7, 55.5],
  Mauritius: [-20.3, 57.6],
  Madagascar: [-18.8, 46.9],

  // Southern Africa
  'South Africa': [-30.6, 22.9],
  Zambia: [-13.1, 27.9],
  Zimbabwe: [-19.0, 29.9],
  Botswana: [-22.3, 24.7],
  Namibia: [-22.0, 17.0],
  Mozambique: [-18.7, 35.5],
  Malawi: [-13.3, 34.3],
  Angola: [-11.2, 17.9],
  Lesotho: [-29.6, 28.2],
  Eswatini: [-26.5, 31.5],
}

export const COUNTRY_POSITIONS: Record<string, { x: number; y: number }> = Object.fromEntries(
  Object.entries(COUNTRY_LATLON).map(([name, [lat, lon]]) => [name, project(lat, lon)]),
)

/**
 * Map position for a country name, or null if it isn't one this map
 * covers — an unknown country simply gets no node rather than being
 * dropped somewhere arbitrary.
 */
export function positionFor(countryName: string | null | undefined): { x: number; y: number } | null {
  if (!countryName) return null
  return COUNTRY_POSITIONS[countryName.trim()] ?? null
}
