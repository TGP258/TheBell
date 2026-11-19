import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pascal.studyplan',
  appName: '百日冲刺',
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
