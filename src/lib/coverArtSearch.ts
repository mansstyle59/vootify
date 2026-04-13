export function searchArtistImage(_name: string, ..._args: any[]): Promise<string | null> { return Promise.resolve(null); }
export async function searchCoverArt(..._args: any[]): Promise<{ coverUrl?: string; album?: string; genre?: string; year?: number } | null> { return null; }
export async function batchSearchCovers(_items: any[], _onProgress?: (done: number, total: number) => void): Promise<Map<number, any>> { return new Map(); }
