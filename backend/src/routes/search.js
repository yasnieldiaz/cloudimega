import { Router } from 'express';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Search files and folders
router.get('/', authenticate, (req, res) => {
  try {
    const { q, type, mimeType, minSize, maxSize, from, to, inTrash } = req.query;

    if (!q || !q.trim()) {
      return res.json({ files: [], folders: [], totalFiles: 0, totalFolders: 0 });
    }

    const searchTerm = `%${q}%`;
    const deletedCondition = inTrash === 'true' ? 'IS NOT NULL' : 'IS NULL';

    // Search files
    let fileQuery = `
      SELECT * FROM files
      WHERE owner_id = ? AND name LIKE ? AND deleted_at ${deletedCondition}
    `;
    const fileParams = [req.user.id, searchTerm];

    if (mimeType) {
      fileQuery += ' AND mime_type LIKE ?';
      fileParams.push(`%${mimeType}%`);
    }

    if (minSize) {
      fileQuery += ' AND size >= ?';
      fileParams.push(parseInt(minSize));
    }

    if (maxSize) {
      fileQuery += ' AND size <= ?';
      fileParams.push(parseInt(maxSize));
    }

    if (from) {
      fileQuery += ' AND created_at >= ?';
      fileParams.push(from);
    }

    if (to) {
      fileQuery += ' AND created_at <= ?';
      fileParams.push(to);
    }

    fileQuery += ' ORDER BY updated_at DESC LIMIT 100';

    const files = db.prepare(fileQuery).all(...fileParams);

    // Search folders
    const folders = db.prepare(`
      SELECT * FROM folders
      WHERE owner_id = ? AND name LIKE ? AND deleted_at ${deletedCondition}
      ORDER BY name ASC LIMIT 50
    `).all(req.user.id, searchTerm);

    res.json({
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mime_type,
        size: f.size,
        path: f.path,
        folderID: f.folder_id,
        isFavorite: !!f.is_favorite,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      folders: folders.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentID: f.parent_id,
        isFavorite: !!f.is_favorite,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      totalFiles: files.length,
      totalFolders: folders.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get recent files
router.get('/recent', authenticate, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 50
    `).all(req.user.id);

    res.json(files.map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mime_type,
      size: f.size,
      path: f.path,
      folderID: f.folder_id,
      isFavorite: !!f.is_favorite,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    })));
  } catch (error) {
    console.error('Recent files error:', error);
    res.status(500).json({ error: 'Failed to get recent files' });
  }
});

// Search files only
router.get('/files', authenticate, (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.json({ items: [], metadata: { page: 1, per: 50, total: 0 } });
    }

    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND name LIKE ? AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 50
    `).all(req.user.id, `%${q}%`);

    res.json({
      items: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mime_type,
        size: f.size,
        path: f.path,
        folderID: f.folder_id,
        isFavorite: !!f.is_favorite,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      metadata: {
        page: 1,
        per: 50,
        total: files.length
      }
    });
  } catch (error) {
    console.error('Search files error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
