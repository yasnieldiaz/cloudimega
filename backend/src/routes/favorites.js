import { Router } from 'express';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all favorites (files and folders)
router.get('/', authenticate, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND is_favorite = 1 AND deleted_at IS NULL
      ORDER BY name ASC
    `).all(req.user.id);

    const folders = db.prepare(`
      SELECT * FROM folders
      WHERE owner_id = ? AND is_favorite = 1 AND deleted_at IS NULL
      ORDER BY name ASC
    `).all(req.user.id);

    res.json({
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mime_type,
        size: f.size,
        path: f.path,
        folderID: f.folder_id,
        isFavorite: true,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      folders: folders.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        parentID: f.parent_id,
        isFavorite: true,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }))
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Add file to favorites
router.post('/files/:fileId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE files SET is_favorite = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.fileId);

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);

    res.json({
      id: updated.id,
      name: updated.name,
      mimeType: updated.mime_type,
      size: updated.size,
      path: updated.path,
      folderID: updated.folder_id,
      isFavorite: true,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

// Remove file from favorites
router.delete('/files/:fileId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE files SET is_favorite = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.fileId);

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);

    res.json({
      id: updated.id,
      name: updated.name,
      mimeType: updated.mime_type,
      size: updated.size,
      path: updated.path,
      folderID: updated.folder_id,
      isFavorite: false,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

// Add folder to favorites
router.post('/folders/:folderId', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    db.prepare(`
      UPDATE folders SET is_favorite = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.folderId);

    const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);

    res.json({
      id: updated.id,
      name: updated.name,
      path: updated.path,
      parentID: updated.parent_id,
      isFavorite: true,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add folder to favorites' });
  }
});

// Remove folder from favorites
router.delete('/folders/:folderId', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    db.prepare(`
      UPDATE folders SET is_favorite = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.folderId);

    const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);

    res.json({
      id: updated.id,
      name: updated.name,
      path: updated.path,
      parentID: updated.parent_id,
      isFavorite: false,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove folder from favorites' });
  }
});

export default router;
