import { supabase } from "@/integrations/supabase/client";

export interface TuneInStation {
  id: string;
  name: string;
  logo: string;
  logoHd: string;
  genre: string;
  currentTrack: string;
  country: string;
  frequency: string;
  slogan: string;
  streamUrl: string;
}

export interface TuneInStationDetail {
  name: string;
  logo: string;
  logoHd: string;
  genre: string;
  genreName: string;
  currentTrack: string;
  currentArtist: string;
  currentAlbumArt: string;
  description: string;
  slogan: string;
  frequency: string;
  location: string;
  language: string;
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tunein-proxy", { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "TuneIn error");
  return data;
}

export const tuneinApi = {
  /** Search stations by name */
  search: async (query: string, limit = 20): Promise<TuneInStation[]> => {
    const data = await invoke({ action: "search", query, limit });
    return data.stations || [];
  },

  /** Get full station details (logo HD, now playing, description) */
  describe: async (stationId: string): Promise<TuneInStationDetail | null> => {
    const data = await invoke({ action: "describe", stationId });
    return data.station || null;
  },

  /** Search and return just logo URLs for matching stations */
  searchLogos: async (query: string, limit = 3): Promise<{ id: string; name: string; logo: string; logoHd: string }[]> => {
    const data = await invoke({ action: "logo_search", query, limit });
    return data.logos || [];
  },

  /** Get now playing metadata for a station */
  nowPlaying: async (stationId: string): Promise<TuneInStationDetail | null> => {
    const data = await invoke({ action: "now_playing", stationId });
    return data.station || null;
  },

  /** Browse trending stations */
  trending: async (limit = 30): Promise<TuneInStation[]> => {
    const data = await invoke({ action: "browse_trending", limit });
    return data.stations || [];
  },
};
