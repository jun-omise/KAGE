import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, writeFileSync, copyFileSync } from 'fs';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;
let serverPort = 3456;

/**
 * Kill any process occupying the given port (dev mode cleanup)
 */
async function killProcessOnPort(port) {
  const { exec } = await import('child_process');
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, (err) => {
      // Wait a moment for port to be released
      setTimeout(resolve, 1000);
    });
  });
}

/**
 * Find an available port. In dev mode, always use preferred port (kill existing process if needed).
 */
async function getAvailablePort(preferred = 3456) {
  const { createServer } = await import('net');
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(preferred, () => {
      server.close(() => resolve(preferred));
    });
    server.on('error', async () => {
      if (isDev) {
        // In dev mode, kill the existing process and use preferred port
        // This ensures Vite proxy (which targets localhost:3456) stays in sync
        console.log(`Port ${preferred} in use — killing existing process for dev mode...`);
        await killProcessOnPort(preferred);
        resolve(preferred);
      } else {
        // In production, find a random available port
        const server2 = createServer();
        server2.listen(0, () => {
          const port = server2.address().port;
          server2.close(() => resolve(port));
        });
      }
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
 * Start the Express server as a child process (avoids native module version mismatch)
 */
async function startServer(port) {
  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'kage.db');
  const envPath = setupEnv();

  const serverScript = isDev
    ? join(__dirname, '..', 'server', 'index.js')
    : join(process.resourcesPath, 'server', 'index.js');

  const projectRoot = isDev ? join(__dirname, '..') : process.resourcesPath;

  return new Promise((resolve, reject) => {
    // Spawn server using system Node.js (not Electron's Node)
    serverProcess = spawn('node', [serverScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        KAGE_DB_PATH: dbPath,
        PORT: String(port),
        NODE_ENV: isDev ? 'development' : 'production',
        ELECTRON: '1',
        DOTENV_CONFIG_PATH: envPath,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server] ${output.trim()}`);
      if (!started && output.includes('running on')) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server process:', error);
      if (!started) {
        reject(error);
      }
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (!started) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout: if server doesn't start within 15 seconds
    setTimeout(() => {
      if (!started) {
        started = true;
        console.warn('Server start timeout — proceeding anyway');
        resolve();
      }
    }, 15000);
  });
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

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[Renderer ${levels[level] || level}] ${message}`);
  });

  // Log page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer] Page load failed: ${errorCode} ${errorDescription} (${validatedURL})`);
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
  if (isDev) {
    // In dev mode, assume server is already running externally (via `node server/index.js`)
    // Just check if server is reachable
    const http = await import('http');
    const serverReady = await new Promise((resolve) => {
      const req = http.get(`http://localhost:${serverPort}/api/health`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });

    if (serverReady) {
      console.log(`Dev mode: server already running on port ${serverPort}`);
    } else {
      // Server not running — start it
      try {
        serverPort = await getAvailablePort(3456);
        await startServer(serverPort);
        console.log(`Server started on port ${serverPort}`);
      } catch (error) {
        console.error('Server startup error:', error);
        dialog.showErrorBox('KAGE Server Error', `Failed to start server: ${error.message}`);
      }
    }
  } else {
    // Production: always start server
    try {
      serverPort = await getAvailablePort(3456);
      await startServer(serverPort);
      console.log(`Server ready on port ${serverPort}`);
    } catch (error) {
      console.error('Server startup error:', error);
      dialog.showErrorBox('KAGE Server Error', `Failed to start server: ${error.message}`);
    }
  }

  createMenu();
  createWindow(serverPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill the server child process
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    console.log('Server process terminated');
  }
});
