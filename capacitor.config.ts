import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sputnikworkshop.papervein',
  appName: 'Paper Vein',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
