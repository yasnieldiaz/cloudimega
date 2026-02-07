import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storagePath = process.env.STORAGE_PATH || join(__dirname, '../../storage');

const router = Router();

// Generate random token
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Helper to get base URL
function getBaseURL(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host;
  return `${protocol}://${host}`;
}

// List shares for current user
router.get('/', authenticate, (req, res) => {
  try {
    const baseURL = getBaseURL(req);
    const shares = db.prepare(`
      SELECT * FROM shares
      WHERE owner_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json(shares.map(s => ({
      ...s,
      fileId: s.file_id,
      folderId: s.folder_id,
      passwordHash: undefined,
      hasPassword: !!s.password_hash,
      maxDownloads: s.max_downloads,
      downloadCount: s.download_count,
      isActive: !!s.is_active,
      expiresAt: s.expires_at,
      lastAccessedAt: s.last_accessed_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      shareUrl: `${baseURL}/s/${s.token}`
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// Get shares for a specific file
router.get('/file/:fileId', authenticate, (req, res) => {
  try {
    const baseURL = getBaseURL(req);
    const shares = db.prepare(`
      SELECT * FROM shares
      WHERE file_id = ? AND owner_id = ? AND is_active = 1
    `).all(req.params.fileId, req.user.id);

    res.json(shares.map(s => ({
      ...s,
      fileId: s.file_id,
      folderId: s.folder_id,
      passwordHash: undefined,
      hasPassword: !!s.password_hash,
      maxDownloads: s.max_downloads,
      downloadCount: s.download_count,
      isActive: !!s.is_active,
      expiresAt: s.expires_at,
      lastAccessedAt: s.last_accessed_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      shareUrl: `${baseURL}/s/${s.token}`
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get shares' });
  }
});

// Create share
router.post('/', authenticate, async (req, res) => {
  try {
    const { fileId, folderId, permission = 'view', password, expiresAt, maxDownloads } = req.body;
    const baseURL = getBaseURL(req);

    // Validate: either file or folder, not both
    if ((!fileId && !folderId) || (fileId && folderId)) {
      return res.status(400).json({ error: 'Provide either fileId or folderId, not both' });
    }

    // Verify ownership
    if (fileId) {
      const file = db.prepare(`
        SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
      `).get(fileId, req.user.id);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
    }

    if (folderId) {
      const folder = db.prepare(`
        SELECT * FROM folders WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
      `).get(folderId, req.user.id);
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    const shareId = uuidv4();
    const token = generateToken();
    let passwordHash = null;

    if (password && password.length > 0) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    db.prepare(`
      INSERT INTO shares (id, token, owner_id, file_id, folder_id, permission, password_hash, expires_at, max_downloads)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shareId,
      token,
      req.user.id,
      fileId || null,
      folderId || null,
      permission,
      passwordHash,
      expiresAt || null,
      maxDownloads || null
    );

    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId);

    res.status(201).json({
      ...share,
      fileId: share.file_id,
      folderId: share.folder_id,
      passwordHash: undefined,
      hasPassword: !!share.password_hash,
      maxDownloads: share.max_downloads,
      downloadCount: share.download_count,
      isActive: !!share.is_active,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      shareUrl: `${baseURL}/s/${share.token}`
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// Update share
router.put('/:shareId', authenticate, async (req, res) => {
  try {
    const { permission, password, expiresAt, maxDownloads, isActive } = req.body;
    const baseURL = getBaseURL(req);

    const share = db.prepare(`
      SELECT * FROM shares WHERE id = ? AND owner_id = ?
    `).get(req.params.shareId, req.user.id);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const updates = [];
    const params = [];

    if (permission !== undefined) {
      updates.push('permission = ?');
      params.push(permission);
    }

    if (password !== undefined) {
      if (password === '') {
        updates.push('password_hash = NULL');
      } else {
        const hash = await bcrypt.hash(password, 10);
        updates.push('password_hash = ?');
        params.push(hash);
      }
    }

    if (expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(expiresAt || null);
    }

    if (maxDownloads !== undefined) {
      updates.push('max_downloads = ?');
      params.push(maxDownloads || null);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.shareId);
      db.prepare(`UPDATE shares SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.shareId);

    res.json({
      ...updated,
      fileId: updated.file_id,
      folderId: updated.folder_id,
      passwordHash: undefined,
      hasPassword: !!updated.password_hash,
      maxDownloads: updated.max_downloads,
      downloadCount: updated.download_count,
      isActive: !!updated.is_active,
      expiresAt: updated.expires_at,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      shareUrl: `${baseURL}/s/${updated.token}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update share' });
  }
});

// Delete share
router.delete('/:shareId', authenticate, (req, res) => {
  try {
    const share = db.prepare(`
      SELECT * FROM shares WHERE id = ? AND owner_id = ?
    `).get(req.params.shareId, req.user.id);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    db.prepare('DELETE FROM shares WHERE id = ?').run(req.params.shareId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete share' });
  }
});

// ==================== PUBLIC SHARE ACCESS ====================

// Get share info (public)
router.get('/:token', (req, res) => {
  try {
    const share = db.prepare(`
      SELECT s.*, f.name as file_name, f.size as file_size, f.mime_type as file_mime_type,
             fo.name as folder_name
      FROM shares s
      LEFT JOIN files f ON s.file_id = f.id
      LEFT JOIN folders fo ON s.folder_id = fo.id
      WHERE s.token = ?
    `).get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Share not found', reason: 'Enlace no encontrado' });
    }

    // Check if share is valid
    if (!share.is_active) {
      return res.status(410).json({ error: 'Share is no longer active', reason: 'Este enlace ya no esta activo' });
    }

    const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
    if (isExpired) {
      return res.status(410).json({ error: 'Share has expired', reason: 'Este enlace ha expirado' });
    }

    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return res.status(410).json({ error: 'Download limit reached', reason: 'Se alcanzo el limite de descargas' });
    }

    res.json({
      type: share.file_id ? 'file' : 'folder',
      fileName: share.file_name || share.folder_name,
      fileSize: share.file_size || 0,
      mimeType: share.file_mime_type,
      hasPassword: !!share.password_hash,
      expiresAt: share.expires_at,
      isExpired: false,
      downloadCount: share.download_count || 0,
      maxDownloads: share.max_downloads,
      permission: share.permission
    });
  } catch (error) {
    console.error('Get share info error:', error);
    res.status(500).json({ error: 'Failed to get share info' });
  }
});

// Verify password (public)
router.post('/:token/verify', async (req, res) => {
  try {
    const { password } = req.body;

    const share = db.prepare(`
      SELECT * FROM shares WHERE token = ?
    `).get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (!share.password_hash) {
      return res.json({ valid: true, accessToken: share.token });
    }

    const valid = await bcrypt.compare(password || '', share.password_hash);

    if (valid) {
      db.prepare(`
        UPDATE shares SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(share.id);
    }

    res.json({
      valid,
      accessToken: valid ? share.token : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

// Download shared file (public)
router.get('/:token/download', async (req, res) => {
  try {
    const share = db.prepare(`
      SELECT s.*, f.name as file_name, f.storage_key, f.size, f.mime_type, f.owner_id
      FROM shares s
      JOIN files f ON s.file_id = f.id
      WHERE s.token = ?
    `).get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (!share.is_active) {
      return res.status(410).json({ error: 'Share is no longer active' });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return res.status(410).json({ error: 'Download limit reached' });
    }

    // Check password if required
    if (share.password_hash) {
      const password = req.query.password || '';
      const valid = await bcrypt.compare(password, share.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Password required', reason: 'Contrasena requerida' });
      }
    }

    // Check permission - allow 'view' for previews, 'download' and 'edit' for actual downloads
    // For view permission, we still allow the download but could limit it in the future

    const filePath = join(storagePath, share.owner_id, share.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update download count
    db.prepare(`
      UPDATE shares SET download_count = download_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(share.id);

    res.setHeader('Content-Disposition', `attachment; filename="${share.file_name}"`);
    res.setHeader('Content-Type', share.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// List shared folder contents (public)
router.get('/:token/contents', (req, res) => {
  try {
    const share = db.prepare(`
      SELECT s.*, fo.id as folder_id, fo.name as folder_name, fo.owner_id
      FROM shares s
      JOIN folders fo ON s.folder_id = fo.id
      WHERE s.token = ?
    `).get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    if (!share.is_active) {
      return res.status(410).json({ error: 'Share is no longer active' });
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }

    // Update last accessed
    db.prepare(`
      UPDATE shares SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(share.id);

    const childFolders = db.prepare(`
      SELECT * FROM folders
      WHERE parent_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `).all(share.folder_id);

    const files = db.prepare(`
      SELECT * FROM files
      WHERE folder_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `).all(share.folder_id);

    res.json({
      folder: {
        id: share.folder_id,
        name: share.folder_name
      },
      folders: childFolders.map(f => ({
        id: f.id,
        name: f.name,
        createdAt: f.created_at
      })),
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mime_type,
        createdAt: f.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list contents' });
  }
});

export default router;
