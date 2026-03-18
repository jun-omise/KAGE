/**
 * electron-builder configuration
 */
export default {
  appId: 'com.kage.app',
  productName: 'KAGE',
  copyright: 'Copyright 2025 Jun Hasegawa',

  files: [
    'server/**/*',
    'client/dist/**/*',
    'electron/**/*',
    'package.json',
    '.env.example',
    '!server/db/kage.db',
    '!**/node_modules/.cache/**',
  ],

  mac: {
    target: ['dmg'],
    icon: 'electron/icons/icon.icns',
    category: 'public.app-category.productivity',
    darkModeSupport: true,
    artifactName: 'KAGE-macOS.${ext}',
  },

  dmg: {
    title: 'KAGE',
    backgroundColor: '#0A0A0F',
    contents: [
      { x: 410, y: 150, type: 'link', path: '/Applications' },
      { x: 130, y: 150, type: 'file' },
    ],
  },

  win: {
    target: ['nsis'],
    icon: 'electron/icons/icon.ico',
  },

  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    artifactName: 'KAGE-Windows-Setup.${ext}',
  },

  linux: {
    target: ['AppImage'],
    icon: 'electron/icons',
    category: 'Utility',
  },

  npmRebuild: true,

  publish: {
    provider: 'github',
    owner: 'jun-omise',
    repo: 'KAGE',
  },
};
