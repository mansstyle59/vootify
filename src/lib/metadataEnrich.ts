export function enrichMetadata(song: any): Promise<any> { return Promise.resolve(song); }
export function resolveStreamUrl(_songId: string, _artist: string, _title: string): Promise<string | null> { return Promise.resolve(null); }
export function normalizeTitle(t: string): string { return t.trim(); }
export function normalizeArtist(a: string): string { return a.trim(); }
export function normalizeText(t: string): string { return t.trim(); }
export function cleanSongTitle(t: string): string { return t.trim(); }
