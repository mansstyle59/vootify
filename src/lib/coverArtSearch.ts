export function searchArtistImage(_name: string, ..._args: any[]): Promise<string | null> { return Promise.resolve(null); }
export function searchCoverArt(_title: string, _artist: string): Promise<string | null> { return Promise.resolve(null); }
export async function batchSearchCovers(_items: any[]): Promise<Map<string, any>> { return new Map(); }
