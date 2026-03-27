import { supabase } from "@/integrations/supabase/client";
import type { RadioBrowserStation } from "@/lib/radioBrowserApi";

export interface MyRadioStation {
  name: string;
  slug: string;
  logoUrl: string;
  logoHdUrl: string;
  nowPlaying: string;
  artist: string;
  title: string;
  pageUrl: string;
}

/** Convert a myradioendirect station into the common RadioBrowserStation format */
function toRadioStation(s: MyRadioStation): RadioBrowserStation {
  return {
    id: `mred-${s.slug}`,
    name: s.name,
    genre: s.nowPlaying ? "En direct" : "Radio",
    coverUrl: s.logoHdUrl || s.logoUrl,
    streamUrl: "", // We don't have stream URLs from scraping — user will need to save/add them
    country: "France",
    countryCode: "FR",
    votes: 0,
    clicks: 0,
    codec: "",
    bitrate: 0,
    // Extra metadata
    _myradio: s,
  } as RadioBrowserStation & { _myradio: MyRadioStation };
}

async function invoke(body: Record<string, unknown>): Promise<MyRadioStation[]> {
  const { data, error } = await supabase.functions.invoke("myradio-scraper", { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "MyRadio scraper error");
  return data.stations || [];
}

export const myRadioApi = {
  /** Get all French stations from myradioendirect.fr */
  getAll: () => invoke({ action: "list" }),

  /** Search stations by name */
  search: (query: string) => invoke({ action: "search", query }),

  /** Get station details (now playing, logo HD) */
  getStation: async (slug: string) => {
    const { data, error } = await supabase.functions.invoke("myradio-scraper", {
      body: { action: "station", slug },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  /** Search and return results in RadioBrowserStation format */
  searchAsStations: async (query: string): Promise<RadioBrowserStation[]> => {
    const stations = await invoke({ action: "search", query });
    return stations.map(toRadioStation);
  },

  /** Get all as RadioBrowserStation format */
  getAllAsStations: async (): Promise<RadioBrowserStation[]> => {
    const stations = await invoke({ action: "list" });
    return stations.map(toRadioStation);
  },
};

/**
 * Build a logo lookup map from myradioendirect stations.
 * Key = normalized station name, Value = HD logo URL.
 */
export function buildMyRadioLogoMap(stations: MyRadioStation[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of stations) {
    const key = s.name.toLowerCase().trim();
    map.set(key, s.logoHdUrl || s.logoUrl);
    // Also add without accents for fuzzy matching
    const noAccent = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (noAccent !== key) map.set(noAccent, s.logoHdUrl || s.logoUrl);
  }
  return map;
}

/**
 * Try to find a myradioendirect HD logo for a station name.
 */
export function findMyRadioLogo(name: string, logoMap: Map<string, string>): string | null {
  const key = name.toLowerCase().trim();
  if (logoMap.has(key)) return logoMap.get(key)!;
  const noAccent = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (logoMap.has(noAccent)) return logoMap.get(noAccent)!;
  // Partial match
  for (const [k, v] of logoMap) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return null;
}
