import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  try {
    const { password, ...user } = req.user;
    res.json({
      ...user,
      storageQuota: user.storage_quota,
      storageUsed: user.storage_used,
      isActive: !!user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update current user profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const validPassword = await bcrypt.compare(currentPassword, req.user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      updates.push('password = ?');
      params.push(hash);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.user.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare(`
      SELECT id, email, name, role, storage_quota, storage_used, is_active, created_at, updated_at FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({
      ...updated,
      storageQuota: updated.storage_quota,
      storageUsed: updated.storage_used,
      isActive: !!updated.is_active,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user storage info
router.get('/storage', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT storage_quota, storage_used FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({
      quota: user.storage_quota,
      used: user.storage_used,
      available: user.storage_quota - user.storage_used,
      percentUsed: Math.round((user.storage_used / user.storage_quota) * 100)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get storage info' });
  }
});

// Search files and folders
router.get('/search', authenticate, (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({ files: [], folders: [] });
    }

    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND name LIKE ? AND deleted_at IS NULL
      ORDER BY name ASC LIMIT 20
    `).all(req.user.id, `%${q}%`);

    const folders = db.prepare(`
      SELECT * FROM folders
      WHERE owner_id = ? AND name LIKE ? AND deleted_at IS NULL AND path != '/'
      ORDER BY name ASC LIMIT 20
    `).all(req.user.id, `%${q}%`);

    res.json({
      files: files.map(f => ({
        ...f,
        isFavorite: !!f.is_favorite,
        mimeType: f.mime_type,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      folders: folders.map(f => ({
        ...f,
        isFavorite: !!f.is_favorite,
        parentId: f.parent_id,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get recent files
router.get('/recent', authenticate, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 20
    `).all(req.user.id);

    res.json(files.map(f => ({
      ...f,
      isFavorite: !!f.is_favorite,
      mimeType: f.mime_type,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recent files' });
  }
});

export default router;
