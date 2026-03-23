import { supabase } from "@/integrations/supabase/client";
import type { RadioStation } from "@/data/mockData";

export const ecouterRadioApi = {
  async getStations(): Promise<RadioStation[]> {
    const { data, error } = await supabase.functions.invoke("ecouterradio-scraper", {
      body: {},
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to scrape ecouterradioenligne.com");

    return (data.stations || []).map((s: { id: string; name: string; genre: string; coverUrl: string; streamUrl: string; listeners: number }) => ({
      id: s.id,
      name: s.name,
      genre: s.genre || "Radio",
      coverUrl: s.coverUrl,
      streamUrl: s.streamUrl,
      listeners: s.listeners || 0,
    }));
  },
};
