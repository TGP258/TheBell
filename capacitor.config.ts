import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pascal.thebell.std',
  appName: 'TheBell',
  webDir: 'dist',
  android: {
    backgroundColor: '#f4f4f7',
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#f4f4f7',
      overlaysWebView: false,
    },
  },
};

export default config;
