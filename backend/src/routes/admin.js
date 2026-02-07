import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from '../models/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, (req, res) => {
  try {
    const { page = 1, perPage = 50, search } = req.query;
    const offset = (page - 1) * perPage;

    let query = 'SELECT id, email, name, role, storage_quota, storage_used, is_active, created_at, updated_at FROM users';
    const params = [];

    if (search) {
      query += ' WHERE name LIKE ? OR email LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(perPage), parseInt(offset));

    const users = db.prepare(query).all(...params);

    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const countParams = [];

    if (search) {
      countQuery += ' WHERE name LIKE ? OR email LIKE ?';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      items: users.map(u => ({
        ...u,
        storageQuota: u.storage_quota,
        storageUsed: u.storage_used,
        isActive: !!u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at
      })),
      metadata: {
        page: parseInt(page),
        per: parseInt(perPage),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Create user (admin only)
router.post('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role = 'user', storageQuota } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password, name, role, storage_quota)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, name, role, storageQuota || 10737418240);

    // Create root folder
    const rootFolderId = uuidv4();
    db.prepare(`
      INSERT INTO folders (id, name, owner_id, path) VALUES (?, ?, ?, ?)
    `).run(rootFolderId, 'Root', userId, '/');

    const user = db.prepare(`
      SELECT id, email, name, role, storage_quota, storage_used, is_active, created_at FROM users WHERE id = ?
    `).get(userId);

    res.status(201).json({
      ...user,
      storageQuota: user.storage_quota,
      storageUsed: user.storage_used,
      isActive: !!user.is_active,
      createdAt: user.created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, storageQuota, isActive } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (email) {
      updates.push('email = ?');
      params.push(email);
    }

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hash);
    }

    if (role) {
      updates.push('role = ?');
      params.push(role);
    }

    if (storageQuota !== undefined) {
      updates.push('storage_quota = ?');
      params.push(storageQuota);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare(`
      SELECT id, email, name, role, storage_quota, storage_used, is_active, created_at, updated_at FROM users WHERE id = ?
    `).get(req.params.userId);

    res.json({
      ...updated,
      storageQuota: updated.storage_quota,
      storageUsed: updated.storage_used,
      isActive: !!updated.is_active,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', authenticate, requireAdmin, (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user data
    db.prepare('DELETE FROM files WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM folders WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM shares WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM tags WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM notes WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM contacts WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM calendar_events WHERE owner_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.params.userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.userId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get system stats (admin only)
router.get('/stats', authenticate, requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const totalFiles = db.prepare('SELECT COUNT(*) as count FROM files WHERE deleted_at IS NULL').get().count;
    const totalFolders = db.prepare('SELECT COUNT(*) as count FROM folders WHERE deleted_at IS NULL').get().count;
    const totalStorageResult = db.prepare('SELECT SUM(storage_used) as total FROM users').get();
    const totalStorage = totalStorageResult?.total || 0;
    const totalShares = db.prepare('SELECT COUNT(*) as count FROM shares WHERE is_active = 1').get().count;

    res.json({
      totalUsers,
      activeUsers,
      totalFiles,
      totalFolders,
      totalStorage,
      totalShares
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
