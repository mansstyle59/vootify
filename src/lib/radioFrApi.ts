import { supabase } from "@/integrations/supabase/client";
import type { RadioStation } from "@/data/mockData";

interface ScrapedStation {
  id: string;
  name: string;
  slug: string;
  genre: string;
  city: string;
  logoUrl: string;
  pageUrl: string;
}

function mapToRadioStation(s: ScrapedStation): RadioStation {
  return {
    id: s.id,
    name: s.name,
    genre: s.genre || "Radio",
    coverUrl: s.logoUrl,
    streamUrl: s.pageUrl,
    listeners: 0,
  };
}

export const radioFrApi = {
  async getStations(): Promise<RadioStation[]> {
    const { data, error } = await supabase.functions.invoke("radio-scraper", {
      body: { action: "list" },
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to scrape radio.fr");

    return (data.stations || []).map(mapToRadioStation);
  },

  async getStationDetails(slug: string): Promise<{ streamUrl?: string; genre?: string; city?: string }> {
    const { data, error } = await supabase.functions.invoke("radio-scraper", {
      body: { action: "details", slug },
    });

    if (error) throw new Error(error.message);
    return data || {};
  },
};
