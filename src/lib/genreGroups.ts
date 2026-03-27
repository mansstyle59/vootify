/** Genre groups: merge similar sub-genres into one display group */
export const genreGroups: Record<string, string[]> = {
  "Rap & Hip-Hop":      ["rap", "hip-hop", "hip hop", "hiphop", "rap français", "rap fr", "french rap", "conscious rap", "gangsta rap", "boom bap"],
  "R&B & Soul":         ["r&b", "rnb", "r and b", "soul", "neo soul", "neo-soul", "contemporary r&b"],
  "Trap & Drill":       ["trap", "drill", "uk drill", "french drill", "chicago drill", "plugg", "pluggnb"],
  "Pop":                ["pop", "pop rock", "synth pop", "synthpop", "electropop", "indie pop", "k-pop", "kpop", "j-pop"],
  "Afro":               ["afro", "afrobeats", "afrobeat", "afro pop", "afropop", "afro-pop", "amapiano", "afro house", "afroswing"],
  "Électro & Dance":    ["électro", "electro", "edm", "electronic", "house", "techno", "dance", "trance", "dubstep", "drum and bass", "dnb", "deep house"],
  "Reggae & Dancehall": ["reggae", "dancehall", "ragga", "dub", "reggaeton"],
  "Latino":             ["latino", "latin", "reggaeton", "salsa", "bachata", "dembow", "cumbia"],
  "Rock & Metal":       ["rock", "metal", "hard rock", "punk", "alternative", "indie rock", "grunge", "heavy metal", "punk rock"],
  "Jazz & Blues":       ["jazz", "blues", "smooth jazz", "jazz fusion", "bebop", "acid jazz"],
  "Funk & Disco":       ["funk", "disco", "boogie", "nu-disco"],
  "Classique":          ["classique", "classical", "orchestral", "opera", "symphonic"],
  "Gospel & Worship":   ["gospel", "worship", "christian", "praise"],
  "Country & Folk":     ["country", "folk", "americana", "bluegrass"],
};

export const genreDefs: Record<string, { emoji: string; from: string; to: string }> = {
  "Rap & Hip-Hop":      { emoji: "🎤", from: "hsl(0 75% 48%)",   to: "hsl(20 85% 30%)" },
  "R&B & Soul":         { emoji: "💜", from: "hsl(240 60% 50%)", to: "hsl(260 50% 32%)" },
  "Trap & Drill":       { emoji: "💎", from: "hsl(270 70% 45%)", to: "hsl(285 60% 25%)" },
  "Pop":                { emoji: "🎵", from: "hsl(330 75% 55%)", to: "hsl(345 65% 38%)" },
  "Afro":               { emoji: "🌍", from: "hsl(30 85% 48%)",  to: "hsl(15 75% 30%)" },
  "Électro & Dance":    { emoji: "⚡", from: "hsl(175 75% 42%)", to: "hsl(195 65% 28%)" },
  "Reggae & Dancehall": { emoji: "🌴", from: "hsl(130 55% 42%)", to: "hsl(150 45% 25%)" },
  "Latino":             { emoji: "💃", from: "hsl(50 85% 52%)",  to: "hsl(35 75% 32%)" },
  "Rock & Metal":       { emoji: "🎸", from: "hsl(210 20% 38%)", to: "hsl(210 15% 20%)" },
  "Jazz & Blues":       { emoji: "🎷", from: "hsl(35 75% 48%)",  to: "hsl(25 65% 28%)" },
  "Funk & Disco":       { emoji: "🪩", from: "hsl(310 65% 52%)", to: "hsl(290 55% 32%)" },
  "Classique":          { emoji: "🎻", from: "hsl(45 55% 48%)",  to: "hsl(40 45% 28%)" },
  "Gospel & Worship":   { emoji: "🙏", from: "hsl(45 70% 50%)",  to: "hsl(30 60% 30%)" },
  "Country & Folk":     { emoji: "🤠", from: "hsl(25 65% 48%)",  to: "hsl(18 55% 28%)" },
};

export const defaultGenreColor = { emoji: "🎶", from: "hsl(160 60% 40%)", to: "hsl(160 50% 25%)" };

/** Build a tag → group name lookup map */
export function buildTagToGroupMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [group, tags] of Object.entries(genreGroups)) {
    for (const tag of tags) m.set(tag.toLowerCase(), group);
  }
  return m;
}

/** Get the set of tags that belong to a genre group */
export function getGenreTags(genreName: string): Set<string> {
  const tags = genreGroups[genreName];
  if (tags) return new Set(tags);
  // Fallback: treat as raw tag
  return new Set([genreName.toLowerCase()]);
}
