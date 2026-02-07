import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const storagePath = process.env.STORAGE_PATH || join(__dirname, '../../storage');

// Stream file
router.get('/:fileId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = join(storagePath, req.user.id, file.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      // Handle range requests for video/audio streaming
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': file.mime_type || 'application/octet-stream'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': file.mime_type || 'application/octet-stream'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// Get file preview (same as stream for now)
router.get('/:fileId/preview', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = join(storagePath, req.user.id, file.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Preview failed' });
  }
});

// Get thumbnail (placeholder - returns same file for images)
router.get('/:fileId/thumbnail', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // For now, return the original file for images
    if (file.mime_type && file.mime_type.startsWith('image/')) {
      const filePath = join(storagePath, req.user.id, file.storage_key);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      res.setHeader('Content-Type', file.mime_type);
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.status(404).json({ error: 'No thumbnail available' });
    }
  } catch (error) {
    console.error('Thumbnail error:', error);
    res.status(500).json({ error: 'Thumbnail failed' });
  }
});

export default router;
