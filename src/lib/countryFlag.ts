// Country name -> ISO 3166-1 alpha-2 code, for the countries that
// actually show up in Monad Africa's real data (profiles.country /
// leaderboard_public.country, stored as the country's plain-text name —
// see Signup.tsx). Deliberately NOT importing `country-state-city` here
// (the ~600KB dataset already used by CountrySelect/Signup/Profile) —
// this is used from lighter pages (Explore, Builders, the homepage)
// that shouldn't inherit that weight just to render a flag. Covers
// Africa plus a handful of other countries the community draws from;
// anything not listed here renders without a flag (see <CountryFlag>) —
// never a wrong or made-up one.
//
// This used to map to a regional-indicator emoji flag (🇳🇬). That's
// what broke desktop: emoji flags are not glyphs a browser draws, they
// are two regional-indicator codepoints the *system font* has to know
// how to combine — Windows ships no country-flag font at all, so
// desktop Chrome/Edge on Windows render "NG" letter boxes (or nothing)
// while Android/iOS render the flag correctly. That's the exact
// mobile-works/desktop-doesn't split reported. Codes now resolve to a
// real SVG asset under /public/flags instead (see <CountryFlag>), which
// renders identically on every platform and needs no network call.
const COUNTRY_CODES: Record<string, string> = {
  Algeria: 'dz', Angola: 'ao', Benin: 'bj', Botswana: 'bw', 'Burkina Faso': 'bf',
  Burundi: 'bi', Cameroon: 'cm', 'Cape Verde': 'cv', 'Central African Republic': 'cf',
  Chad: 'td', Comoros: 'km', Congo: 'cg', 'DR Congo': 'cd', 'Democratic Republic of the Congo': 'cd',
  Djibouti: 'dj', Egypt: 'eg', 'Equatorial Guinea': 'gq', Eritrea: 'er', Eswatini: 'sz',
  Ethiopia: 'et', Gabon: 'ga', Gambia: 'gm', Ghana: 'gh', Guinea: 'gn',
  'Guinea-Bissau': 'gw', 'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', Kenya: 'ke',
  Lesotho: 'ls', Liberia: 'lr', Libya: 'ly', Madagascar: 'mg', Malawi: 'mw',
  Mali: 'ml', Mauritania: 'mr', Mauritius: 'mu', Morocco: 'ma', Mozambique: 'mz',
  Namibia: 'na', Niger: 'ne', Nigeria: 'ng', Rwanda: 'rw', 'Sao Tome and Principe': 'st',
  Senegal: 'sn', Seychelles: 'sc', 'Sierra Leone': 'sl', Somalia: 'so', 'South Africa': 'za',
  'South Sudan': 'ss', Sudan: 'sd', Tanzania: 'tz', Togo: 'tg', Tunisia: 'tn',
  Uganda: 'ug', Zambia: 'zm', Zimbabwe: 'zw',
  'United States': 'us', 'United Kingdom': 'gb', Canada: 'ca', India: 'in',
  'United Arab Emirates': 'ae', Germany: 'de', France: 'fr',
}

/** ISO 3166-1 alpha-2 code for a country name, or null if unknown. */
export function countryCodeFor(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  return COUNTRY_CODES[countryName.trim()] ?? null
}

/** Path to the locally-hosted SVG flag asset, or null if unknown. */
export function flagSrcFor(countryName: string | null | undefined): string | null {
  const code = countryCodeFor(countryName)
  return code ? `/flags/${code}.svg` : null
}
