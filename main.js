const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs   = require('fs');
const { Pool } = require('pg');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindow;

// ── Database Connection (Supabase Session Pooler - ap-southeast-2) ────────────────────────────────
const pool = new Pool({
  connectionString: 'postgresql://postgres.wuukojmlqlguusloqugl:Ggsms%402026%21@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres',
  
  ssl: { 
    rejectUnauthorized: false 
  },
  
  // Optimized settings for Electron desktop app + Supabase pooler
  connectionTimeoutMillis: 25000,   // 25 seconds (increased for reliability)
  idleTimeoutMillis: 30000,
  max: 8,                           // Keep pool size reasonable
  allowExitOnIdle: true,
});

pool.on('connect', () => {
  console.log('✅ Successfully connected to Supabase Session Pooler (ap-southeast-2)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected pool error:', err.message);
});

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    frame: false,
    transparent: true,
    backgroundColor: '#00000000',

    icon: path.join(__dirname, 'images', 'shipicon.png'),
    show: false,
    resizable: true,

    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.setBounds(workArea);
    mainWindow.show();
  });

  mainWindow.on('resize', () => {
    const [currentWidth, currentHeight] = mainWindow.getSize();
    if (currentWidth < 1000 || currentHeight < 700) {
      mainWindow.setSize(
        Math.max(currentWidth, 1000),
        Math.max(currentHeight, 700)
      );
    }
  });
}

// ── Auto Updater ─────────────────────────────────────────────────────────
function initAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    mainWindow?.webContents.send('update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('AutoUpdater error:', err.message);
    mainWindow?.webContents.send('update-error', err.message);
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── Custom Window Controls ───────────────────────────────────────────────
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    const { workArea } = screen.getPrimaryDisplay();
    mainWindow.setBounds(workArea);
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// ── Database IPC Handler ─────────────────────────────────────────────────
ipcMain.handle('db-query', async (event, { sql, params = [] }) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      command: result.command,
    };
  } catch (err) {
    console.error('Database query error:', err);
    throw new Error(err.message || 'Database query failed');
  } finally {
    if (client) client.release();
  }
});

// ── Persistent Session Handlers ──────────────────────────────────────────
const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');

ipcMain.handle('session-set', (_, data) => {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data), 'utf-8');
    return true;
  } catch (err) {
    console.error('session-set error:', err);
    return false;
  }
});

ipcMain.handle('session-get', () => {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  } catch (err) {
    console.error('session-get error:', err);
    return null;
  }
});

ipcMain.handle('session-clear', () => {
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
    return true;
  } catch (err) {
    console.error('session-clear error:', err);
    return false;
  }
});

// ── Company Logo File Handlers ───────────────────────────────────────────
const LOGO_DIR = path.join(app.getPath('userData'), 'CompanyLogos');

if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

ipcMain.handle('save-company-logo', async (event, { id, base64Data }) => {
  try {
    const filePath = path.join(LOGO_DIR, `${id}.png`);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return { success: true };
  } catch (err) {
    console.error('save-company-logo error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-company-logo', async (event, { id }) => {
  try {
    const filePath = path.join(LOGO_DIR, `${id}.png`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath);
    return 'data:image/png;base64,' + data.toString('base64');
  } catch (err) {
    return null;
  }
});

ipcMain.handle('delete-company-logo', async (event, { id }) => {
  try {
    const filePath = path.join(LOGO_DIR, `${id}.png`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    console.error('delete-company-logo error:', err);
    return { success: false, error: err.message };
  }
});

// ── Updater IPC Handlers ─────────────────────────────────────────────────
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async () => {
  return autoUpdater.checkForUpdates();
});

// ── Graceful Shutdown ────────────────────────────────────────────────────
app.on('before-quit', async () => {
  console.log('Closing PostgreSQL pool...');
  await pool.end().catch(console.error);
});