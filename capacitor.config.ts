import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.vootify',
  appName: 'Vootify',
  webDir: 'dist',
  // Pour le dev live-reload, décommenter :
  // server: {
  //   url: 'https://3897df85-e2e7-40d2-8303-58cb60035834.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
};

export default config;
