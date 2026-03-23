export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  coverUrl: string;
  streamUrl: string;
  liked: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: number;
  songs: string[];
}

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  listeners: number;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl: string;
  songIds: string[];
  createdAt: string;
}

const covers = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop",
];

export const songs: Song[] = [
  { id: "s1", title: "Midnight Drive", artist: "Neon Pulse", album: "After Hours", duration: 234, coverUrl: covers[0], streamUrl: "", liked: true },
  { id: "s2", title: "Crystal Waves", artist: "Aurora Sky", album: "Dreamscape", duration: 198, coverUrl: covers[1], streamUrl: "", liked: false },
  { id: "s3", title: "Electric Soul", artist: "Velvet Echo", album: "Resonance", duration: 267, coverUrl: covers[2], streamUrl: "", liked: true },
  { id: "s4", title: "Starlight", artist: "Luna Frost", album: "Cosmos", duration: 312, coverUrl: covers[3], streamUrl: "", liked: false },
  { id: "s5", title: "Golden Hour", artist: "Amber Haze", album: "Sunset Boulevard", duration: 189, coverUrl: covers[4], streamUrl: "", liked: true },
  { id: "s6", title: "Neon Dreams", artist: "Neon Pulse", album: "After Hours", duration: 245, coverUrl: covers[0], streamUrl: "", liked: false },
  { id: "s7", title: "Ocean Breeze", artist: "Aurora Sky", album: "Dreamscape", duration: 276, coverUrl: covers[1], streamUrl: "", liked: true },
  { id: "s8", title: "Phantom", artist: "Dark Lotus", album: "Shadows", duration: 301, coverUrl: covers[5], streamUrl: "", liked: false },
  { id: "s9", title: "Velocity", artist: "Chrome Circuit", album: "Hyperdrive", duration: 218, coverUrl: covers[6], streamUrl: "", liked: false },
  { id: "s10", title: "Bloom", artist: "Petal Storm", album: "Garden of Sound", duration: 253, coverUrl: covers[7], streamUrl: "", liked: true },
  { id: "s11", title: "Infinity Loop", artist: "Chrome Circuit", album: "Hyperdrive", duration: 199, coverUrl: covers[6], streamUrl: "", liked: false },
  { id: "s12", title: "Ember Glow", artist: "Amber Haze", album: "Sunset Boulevard", duration: 284, coverUrl: covers[4], streamUrl: "", liked: true },
];

export const albums: Album[] = [
  { id: "a1", title: "After Hours", artist: "Neon Pulse", coverUrl: covers[0], year: 2024, songs: ["s1", "s6"] },
  { id: "a2", title: "Dreamscape", artist: "Aurora Sky", coverUrl: covers[1], year: 2024, songs: ["s2", "s7"] },
  { id: "a3", title: "Resonance", artist: "Velvet Echo", coverUrl: covers[2], year: 2023, songs: ["s3"] },
  { id: "a4", title: "Cosmos", artist: "Luna Frost", coverUrl: covers[3], year: 2024, songs: ["s4"] },
  { id: "a5", title: "Sunset Boulevard", artist: "Amber Haze", coverUrl: covers[4], year: 2023, songs: ["s5", "s12"] },
  { id: "a6", title: "Shadows", artist: "Dark Lotus", coverUrl: covers[5], year: 2024, songs: ["s8"] },
  { id: "a7", title: "Hyperdrive", artist: "Chrome Circuit", coverUrl: covers[6], year: 2024, songs: ["s9", "s11"] },
  { id: "a8", title: "Garden of Sound", artist: "Petal Storm", coverUrl: covers[7], year: 2023, songs: ["s10"] },
];

export const radioStations: RadioStation[] = [
  { id: "r1", name: "Chill Lounge", genre: "Lo-Fi / Chill", coverUrl: covers[1], streamUrl: "", listeners: 12400 },
  { id: "r2", name: "Electric Avenue", genre: "Electronic", coverUrl: covers[0], streamUrl: "", listeners: 8900 },
  { id: "r3", name: "Indie Vibes", genre: "Indie / Alternative", coverUrl: covers[7], streamUrl: "", listeners: 6200 },
  { id: "r4", name: "Hip Hop Central", genre: "Hip Hop / R&B", coverUrl: covers[5], streamUrl: "", listeners: 15800 },
  { id: "r5", name: "Classical FM", genre: "Classical", coverUrl: covers[3], streamUrl: "", listeners: 3400 },
  { id: "r6", name: "Rock Nation", genre: "Rock", coverUrl: covers[2], streamUrl: "", listeners: 9100 },
];

export const defaultPlaylists: Playlist[] = [
  { id: "p1", name: "Late Night Vibes", coverUrl: covers[0], songIds: ["s1", "s3", "s5", "s8"], createdAt: "2024-01-15" },
  { id: "p2", name: "Morning Energy", coverUrl: covers[4], songIds: ["s2", "s9", "s11"], createdAt: "2024-02-20" },
  { id: "p3", name: "Chill Mix", coverUrl: covers[1], songIds: ["s7", "s10", "s4", "s12"], createdAt: "2024-03-10" },
];

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
