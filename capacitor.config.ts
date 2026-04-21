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
  plugins: {
    Filesystem: {
      // Aucune option requise — le dossier "Vootify Music" sera créé
      // automatiquement dans Documents à chaque téléchargement de morceau.
    },
  },
  ios: {
    // Pour que le dossier "Vootify Music" apparaisse dans l'app Fichiers
    // d'iPhone, ajoutez ces clés dans ios/App/App/Info.plist :
    //   <key>UIFileSharingEnabled</key><true/>
    //   <key>LSSupportsOpeningDocumentsInPlace</key><true/>
    // Ces clés sont ajoutées automatiquement lors de `npx cap sync` si
    // elles sont présentes dans le fichier Info.plist du projet Xcode.
  },
};

export default config;
