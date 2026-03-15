import { Router } from 'express';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { dirname } from 'path';

const router = Router();

// POST /open - Open a file with default app or specific app
router.post('/open', (req, res) => {
  try {
    const { path, app } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    if (!existsSync(path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const platform = process.platform;
    let command;

    if (app === 'vscode') {
      command = `code "${path}"`;
    } else if (platform === 'darwin') {
      command = `open "${path}"`;
    } else if (platform === 'linux') {
      command = `xdg-open "${path}"`;
    } else if (platform === 'win32') {
      command = `start "" "${path}"`;
    } else {
      return res.status(500).json({ error: 'Unsupported platform' });
    }

    exec(command, (err) => {
      if (err) {
        console.error('Open file error:', err);
        return res.status(500).json({ error: 'Failed to open file' });
      }
      res.json({ success: true, path });
    });
  } catch (error) {
    console.error('Open file error:', error);
    res.status(500).json({ error: 'Failed to open file' });
  }
});

// POST /open-folder - Open the containing folder
router.post('/open-folder', (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const folder = existsSync(path) ? (require('fs').statSync(path).isDirectory() ? path : dirname(path)) : dirname(path);

    if (!existsSync(folder)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const platform = process.platform;
    let command;

    if (platform === 'darwin') {
      command = `open "${folder}"`;
    } else if (platform === 'linux') {
      command = `xdg-open "${folder}"`;
    } else if (platform === 'win32') {
      command = `explorer "${folder}"`;
    } else {
      return res.status(500).json({ error: 'Unsupported platform' });
    }

    exec(command, (err) => {
      if (err) {
        console.error('Open folder error:', err);
        return res.status(500).json({ error: 'Failed to open folder' });
      }
      res.json({ success: true, folder });
    });
  } catch (error) {
    console.error('Open folder error:', error);
    res.status(500).json({ error: 'Failed to open folder' });
  }
});

export default router;
