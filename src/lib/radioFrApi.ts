import { supabase } from "@/integrations/supabase/client";
import type { RadioStation } from "@/data/mockData";

interface ScrapedStation {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  pageUrl: string;
}

interface GenreInfo {
  name: string;
  slug: string;
  url: string;
}

interface RegionInfo {
  name: string;
  slug: string;
  url: string;
}

interface ScraperResponse {
  success: boolean;
  stations: ScrapedStation[];
  genres: GenreInfo[];
  regions: RegionInfo[];
  error?: string;
}

function mapToRadioStation(s: ScrapedStation): RadioStation {
  return {
    id: s.id,
    name: s.name,
    genre: "Radio",
    coverUrl: s.logoUrl,
    streamUrl: s.pageUrl,
    listeners: 0,
  };
}

export const radioEnLigneApi = {
  async getStations(options?: { genre?: string; region?: string }): Promise<{
    stations: RadioStation[];
    genres: GenreInfo[];
    regions: RegionInfo[];
  }> {
    const body: Record<string, string> = { action: "list" };
    if (options?.genre) {
      body.action = "genre";
      body.genre = options.genre;
    } else if (options?.region) {
      body.action = "region";
      body.region = options.region;
    }

    const { data, error } = await supabase.functions.invoke("radio-scraper", { body });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to scrape radio-en-ligne.fr");

    const response = data as ScraperResponse;
    return {
      stations: (response.stations || []).map(mapToRadioStation),
      genres: response.genres || [],
      regions: response.regions || [],
    };
  },
};

// Keep backward compat
export const radioFrApi = {
  async getStations(): Promise<RadioStation[]> {
    const { stations } = await radioEnLigneApi.getStations();
    return stations;
  },
};

// --- TVRadioZap scraper ---
interface TVRZStation {
  id: string;
  name: string;
  category: string;
  genre: string;
  country: string;
  logoUrl: string;
  siteUrl: string;
  notes: string;
}

function mapTVRZToRadioStation(s: TVRZStation): RadioStation {
  return {
    id: s.id,
    name: s.name,
    genre: s.genre || s.category || "Radio",
    coverUrl: s.logoUrl,
    streamUrl: s.siteUrl,
    listeners: 0,
  };
}

export const tvRadioZapApi = {
  async getStations(type = "trztop"): Promise<RadioStation[]> {
    const { data, error } = await supabase.functions.invoke("tvradiozap-scraper", {
      body: { type },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to scrape TVRadioZap");
    return (data.stations || []).map(mapTVRZToRadioStation);
  },
};
