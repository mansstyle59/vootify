import { supabase } from "@/integrations/supabase/client";
import { getStationLogo } from "@/lib/radioLogos";

export interface RadioBrowserStation {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  country: string;
  countryCode: string;
  votes: number;
  clicks: number;
  codec: string;
  bitrate: number;
}

async function invoke(body: Record<string, unknown>): Promise<RadioBrowserStation[]> {
  const { data, error } = await supabase.functions.invoke("radio-browser", { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Radio browser error");
  const stations: RadioBrowserStation[] = data.stations || [];

  // Use synchronous local logo matching — no slow Deezer lookups blocking display
  return stations.map((s) => ({
    ...s,
    coverUrl: getStationLogo(s.name, s.coverUrl),
  }));
}

export const radioBrowserApi = {
  getTopFrench: (limit = 30) => invoke({ action: "by_country", country: "France", limit }),
  getTop: (limit = 30) => invoke({ action: "top", limit }),
  getByTag: (tag: string, limit = 30) => invoke({ action: "by_tag", tag, limit }),
  getByCountry: (country: string, limit = 30) => invoke({ action: "by_country", country, limit }),
  search: (query: string, limit = 30) => invoke({ action: "search", query, limit }),
  getTagCounts: async (tags: string[]): Promise<Record<string, number>> => {
    const { data, error } = await supabase.functions.invoke("radio-browser", {
      body: { action: "tag_counts", tags },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Tag counts error");
    return data.counts || {};
  },
};
