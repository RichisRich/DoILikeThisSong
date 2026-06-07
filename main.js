const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const coverCacheDir = path.join(app.getPath('userData'), 'cover-cache');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: 'Do I Like This Song?',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('read-audio-files', async (_, folderPath) => {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(mp3|m4a|flac|wav|ogg|aac|opus)$/i.test(entry.name))
    .map((entry) => path.join(folderPath, entry.name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
});

ipcMain.handle('move-rated-files', async (_, folderPath, ratings) => {
  const likedDir = path.join(folderPath, 'liked');
  const dislikedDir = path.join(folderPath, 'disliked');

  await fs.mkdir(likedDir, { recursive: true });
  await fs.mkdir(dislikedDir, { recursive: true });

  const moved = { liked: 0, disliked: 0 };

  for (const [filePath, vote] of Object.entries(ratings || {})) {
    if (!filePath || !['up', 'down'].includes(vote)) continue;

    const sourcePath = filePath;
    const destinationDir = vote === 'up' ? likedDir : dislikedDir;
    const destinationPath = path.join(destinationDir, path.basename(filePath));

    try {
      await fs.rename(sourcePath, destinationPath);
      moved[vote === 'up' ? 'liked' : 'disliked'] += 1;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return moved;
});

ipcMain.handle('get-metadata', async (_, filePath) => {
  try {
    await fs.mkdir(coverCacheDir, { recursive: true });

    const { parseFile } = await import('music-metadata');
    const meta = await parseFile(filePath, { native: false });
    const common = meta.common || {};
    const title = common.title || path.basename(filePath, path.extname(filePath));
    const artist = common.artist || 'Unknown artist';

    let art = common.picture && common.picture[0] ? common.picture[0] : null;
    let coverPath = null;
    let picture = null;

    if (art) {
      const artBuffer = Buffer.isBuffer(art.data) ? art.data : Buffer.from(art.data || []);
      picture = `data:${art.format};base64,${artBuffer.toString('base64')}`;
    }

    if (!art) {
      try {
        const metadataCandidates = [
          `${artist} ${title}`,
          `${artist} - ${title}`,
          `${title} ${common.album || ''}`.trim(),
          `${artist} ${common.album || ''}`.trim(),
          title,
          artist,
          common.album,
          common.albumartist,
          path.basename(filePath, path.extname(filePath))
        ].filter(Boolean).map((value) => value.trim()).filter((value, index, arr) => value && arr.indexOf(value) === index);

        for (const candidate of metadataCandidates) {
          for (const entity of ['song', 'album']) {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(candidate)}&entity=${entity}&limit=5`);
            const data = await response.json();
            const result = data.results && data.results.find((entry) => entry && entry.artworkUrl100);

            if (result && result.artworkUrl100) {
              const imageResponse = await fetch(result.artworkUrl100.replace('100x100bb', '300x300bb'));
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const safeName = path.basename(filePath, path.extname(filePath)).replace(/[^a-z0-9_-]+/gi, '_');
              coverPath = path.join(coverCacheDir, `${safeName}-${Date.now()}.jpg`);
              await fs.writeFile(coverPath, imageBuffer);
              picture = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
              break;
            }
          }

          if (picture) break;
        }
      } catch (onlineError) {
        // Ignore online lookup failures and fall back to no artwork.
      }
    } else {
      const artBuffer = Buffer.isBuffer(art.data) ? art.data : Buffer.from(art.data || []);
      const safeName = path.basename(filePath, path.extname(filePath)).replace(/[^a-z0-9_-]+/gi, '_');
      const ext = art.format === 'image/jpeg' ? 'jpg' : art.format === 'image/png' ? 'png' : 'png';
      coverPath = path.join(coverCacheDir, `${safeName}-${Date.now()}.${ext}`);
      await fs.writeFile(coverPath, artBuffer);
    }

    return {
      success: true,
      title,
      artist,
      album: common.album || 'Unknown album',
      duration: meta.format?.duration || null,
      picture,
      coverPath
    };
  } catch (error) {
    return {
      success: false,
      title: path.basename(filePath),
      artist: 'Unknown artist',
      album: 'Unknown album',
      duration: null,
      picture: null,
      error: error.message
    };
  }
});
