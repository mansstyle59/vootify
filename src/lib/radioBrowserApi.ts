import { supabase } from "@/integrations/supabase/client";
import type { RadioStation } from "@/data/mockData";

interface RadioBrowserStation {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  votes: number;
  clickcount: number;
  codec: string;
  bitrate: number;
  country: string;
  homepage: string;
}

function mapToRadioStation(s: RadioBrowserStation): RadioStation {
  return {
    id: s.id,
    name: s.name,
    genre: s.genre || "Radio",
    coverUrl: s.coverUrl,
    streamUrl: s.streamUrl,
    listeners: s.clickcount || 0,
  };
}

export const radioBrowserApi = {
  async getStations(options?: {
    country?: string;
    tag?: string;
    name?: string;
    limit?: number;
    action?: string;
  }): Promise<RadioStation[]> {
    const body: Record<string, unknown> = {
      action: options?.action || "default",
      country: options?.country || "FR",
      limit: options?.limit || 50,
    };

    if (options?.tag) {
      body.action = "bytag";
      body.tag = options.tag;
    }
    if (options?.name) {
      body.action = "search";
      body.name = options.name;
    }

    const { data, error } = await supabase.functions.invoke("radio-browser", { body });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to fetch radio stations");

    return (data.stations || []).map(mapToRadioStation);
  },

  async getTags(): Promise<Array<{ name: string; stationcount: number }>> {
    const { data, error } = await supabase.functions.invoke("radio-browser", {
      body: { action: "tags" },
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to fetch tags");

    return data.tags || [];
  },
};
