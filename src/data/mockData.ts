export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
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

export const songs: Song[] = [];
export const albums: Album[] = [];
export const radioStations: RadioStation[] = [];
export const defaultPlaylists: Playlist[] = [];

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
