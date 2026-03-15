import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync, copyFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;
let serverInstance;

/**
 * Find an available port
 */
async function getAvailablePort(preferred = 3456) {
  const { createServer } = await import('net');
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, () => {
      server.close(() => resolve(preferred));
    });
    server.on('error', () => {
      // Port in use, try next
      const server2 = createServer();
      server2.listen(0, () => {
        const port = server2.address().port;
        server2.close(() => resolve(port));
      });
    });
  });
}

/**
 * Setup .env in userData if first launch
 */
function setupEnv() {
  const userDataPath = app.getPath('userData');
  const envPath = join(userDataPath, '.env');

  if (!existsSync(envPath)) {
    // Copy .env.example or create minimal
    const projectRoot = isDev ? join(__dirname, '..') : process.resourcesPath;
    const examplePath = join(projectRoot, '.env.example');

    if (existsSync(examplePath)) {
      copyFileSync(examplePath, envPath);
    } else {
      writeFileSync(envPath, [
        'ANTHROPIC_API_KEY=your-api-key-here',
        'JWT_SECRET=change-this-to-a-random-string',
        'PORT=3456',
      ].join('\n'));
    }
  }

  return envPath;
}

/**
 * Start the Express server
 */
async function startServer(port) {
  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'kage.db');

  // Set environment variables
  process.env.KAGE_DB_PATH = dbPath;
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'production';
  process.env.ELECTRON = '1';

  // Load .env from userData
  const envPath = setupEnv();
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  } catch {}

  // Import and start the server
  const serverPath = isDev
    ? join(__dirname, '..', 'server', 'index.js')
    : join(process.resourcesPath, 'server', 'index.js');

  try {
    const serverModule = await import(serverPath);
    serverInstance = serverModule.server || serverModule.default;
    console.log(`KAGE server started on port ${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    dialog.showErrorBox('KAGE Server Error', `Failed to start: ${error.message}`);
  }
}

/**
 * Create the main browser window
 */
function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'KAGE',
    backgroundColor: '#0A0A0F',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`http://localhost:${port}`);
  }

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Application menu
 */
function createMenu() {
  const template = [
    {
      label: 'KAGE',
      submenu: [
        { role: 'about', label: 'About KAGE' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', '/settings');
            }
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => shell.openExternal('https://github.com/jun-omise/KAGE'),
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/jun-omise/KAGE/issues'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// App lifecycle
app.whenReady().then(async () => {
  const port = await getAvailablePort(3456);
  await startServer(port);
  createMenu();
  createWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup
  if (serverInstance?.close) {
    serverInstance.close();
  }
  try {
    const { closeDb } = require(join(__dirname, '..', 'server', 'db', 'init.js'));
    closeDb();
  } catch {}
});
