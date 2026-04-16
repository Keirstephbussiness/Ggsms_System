const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { Pool } = require('pg');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

let mainWindow;

// ── Database Connection ───────────────────────────────────────────────────
const pool = new Pool({
  connectionString: 'postgresql://postgres.wuukojmlqlguusloqugl:Ggsms%402026%21@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 25000,
  idleTimeoutMillis: 30000,
  max: 8,
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

// ── Auto Updater ──────────────────────────────────────────────────────────
function initAutoUpdater() {
  // ── Logging setup ──
  log.transports.file.level = 'debug';
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // ── Force dev update check (remove after testing) ──
  // autoUpdater.forceDevUpdateConfig = true;

  log.info('App version:', app.getVersion());
  log.info('Starting update check...');

  // ── Check after 4 seconds so window is ready ──
  setTimeout(() => {
    log.info('Calling checkForUpdates()...');
    autoUpdater.checkForUpdates().catch(err => {
      log.error('checkForUpdates failed:', err.message);
    });
  }, 4000);

  // ── Update found ──
  autoUpdater.on('update-available', (info) => {
    log.info('✅ Update available:', info.version);

    // Show native dialog so user always sees it
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'Downloading update now in the background...',
      buttons: ['OK'],
    });

    mainWindow?.webContents.send('update-available', info);
  });

  // ── No update ──
  autoUpdater.on('update-not-available', (info) => {
    log.info('ℹ️ No update available. Current version is latest:', info.version);
    mainWindow?.webContents.send('update-not-available', info);
  });

  // ── Download progress ──
  autoUpdater.on('download-progress', (progress) => {
    const msg = `Download speed: ${Math.round(progress.bytesPerSecond / 1024)} KB/s | ${Math.round(progress.percent)}% | ${Math.round(progress.transferred / 1024)}KB / ${Math.round(progress.total / 1024)}KB`;
    log.info(msg);
    mainWindow?.webContents.send('update-progress', progress);
  });

  // ── Downloaded — prompt user to install ──
  autoUpdater.on('update-downloaded', (info) => {
    log.info('✅ Update downloaded:', info.version);
    mainWindow?.webContents.send('update-downloaded', info);

    // Show native install dialog — user can't miss this
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Update Ready to Install',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the application now to apply the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        log.info('User accepted update. Installing...');
        autoUpdater.quitAndInstall(false, true);
      } else {
        log.info('User deferred update install.');
      }
    });
  });

  // ── Error handling ──
  autoUpdater.on('error', (err) => {
    log.error('❌ AutoUpdater error:', err.message);
    log.error(err.stack);
    mainWindow?.webContents.send('update-error', err.message);

    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: 'Failed to check for updates.',
      detail: err.message,
      buttons: ['OK'],
    });
  });
}

// ── App Lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Custom Window Controls ────────────────────────────────────────────────
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

// ── Database IPC Handler ──────────────────────────────────────────────────
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

// ── Persistent Session Handlers ───────────────────────────────────────────
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

// ── Company Logo File Handlers ────────────────────────────────────────────
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

// ── Updater IPC Handlers ──────────────────────────────────────────────────
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('check-for-updates', async () => {
  return autoUpdater.checkForUpdates();
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────
app.on('before-quit', async () => {
  console.log('Closing PostgreSQL pool...');
  await pool.end().catch(console.error);
});