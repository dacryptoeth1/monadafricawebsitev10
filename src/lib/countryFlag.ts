// A small, dependency-free name -> emoji flag lookup for the countries
// that actually show up in Monad Africa's real data (profiles.country /
// leaderboard_public.country, stored as the country's plain-text name —
// see Signup.tsx). Deliberately NOT importing `country-state-city` here
// (the ~600KB dataset already used by CountrySelect/Signup/Profile) —
// this is used from lighter pages (Explore, Builders, the homepage)
// that shouldn't inherit that weight just to render a flag. Covers
// Africa plus a handful of other countries the community draws from;
// anything not listed here just renders without a flag (see callers) —
// never a wrong or made-up one.
const FLAGS: Record<string, string> = {
  Algeria: '🇩🇿', Angola: '🇦🇴', Benin: '🇧🇯', Botswana: '🇧🇼', 'Burkina Faso': '🇧🇫',
  Burundi: '🇧🇮', Cameroon: '🇨🇲', 'Cape Verde': '🇨🇻', 'Central African Republic': '🇨🇫',
  Chad: '🇹🇩', Comoros: '🇰🇲', Congo: '🇨🇬', 'DR Congo': '🇨🇩', 'Democratic Republic of the Congo': '🇨🇩',
  Djibouti: '🇩🇯', Egypt: '🇪🇬', 'Equatorial Guinea': '🇬🇶', Eritrea: '🇪🇷', Eswatini: '🇸🇿',
  Ethiopia: '🇪🇹', Gabon: '🇬🇦', Gambia: '🇬🇲', Ghana: '🇬🇭', Guinea: '🇬🇳',
  'Guinea-Bissau': '🇬🇼', 'Ivory Coast': '🇨🇮', "Côte d'Ivoire": '🇨🇮', Kenya: '🇰🇪',
  Lesotho: '🇱🇸', Liberia: '🇱🇷', Libya: '🇱🇾', Madagascar: '🇲🇬', Malawi: '🇲🇼',
  Mali: '🇲🇱', Mauritania: '🇲🇷', Mauritius: '🇲🇺', Morocco: '🇲🇦', Mozambique: '🇲🇿',
  Namibia: '🇳🇦', Niger: '🇳🇪', Nigeria: '🇳🇬', Rwanda: '🇷🇼', 'Sao Tome and Principe': '🇸🇹',
  Senegal: '🇸🇳', Seychelles: '🇸🇨', 'Sierra Leone': '🇸🇱', Somalia: '🇸🇴', 'South Africa': '🇿🇦',
  'South Sudan': '🇸🇸', Sudan: '🇸🇩', Tanzania: '🇹🇿', Togo: '🇹🇬', Tunisia: '🇹🇳',
  Uganda: '🇺🇬', Zambia: '🇿🇲', Zimbabwe: '🇿🇼',
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦', India: '🇮🇳',
  'United Arab Emirates': '🇦🇪', Germany: '🇩🇪', France: '🇫🇷',
}

export function flagFor(countryName: string | null | undefined): string | null {
  if (!countryName) return null
  return FLAGS[countryName.trim()] ?? null
}
