import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mime from 'mime-types';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';
import { authenticate, verifyToken } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cloudimega-secret-key-change-in-production';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const storagePath = process.env.STORAGE_PATH || join(__dirname, '../../storage');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = join(storagePath, req.user.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const storageKey = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, storageKey);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// List files
router.get('/', authenticate, (req, res) => {
  try {
    const { folderId, search, page = 1, perPage = 50 } = req.query;
    const offset = (page - 1) * perPage;

    let query = `
      SELECT * FROM files
      WHERE owner_id = ? AND deleted_at IS NULL
    `;
    const params = [req.user.id];

    if (folderId) {
      query += ' AND folder_id = ?';
      params.push(folderId);
    }

    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(perPage), parseInt(offset));

    const files = db.prepare(query).all(...params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total FROM files
      WHERE owner_id = ? AND deleted_at IS NULL
    `;
    const countParams = [req.user.id];

    if (folderId) {
      countQuery += ' AND folder_id = ?';
      countParams.push(folderId);
    }

    if (search) {
      countQuery += ' AND name LIKE ?';
      countParams.push(`%${search}%`);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      items: files.map(f => ({
        ...f,
        isFavorite: !!f.is_favorite,
        mimeType: f.mime_type,
        storageKey: f.storage_key,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      metadata: {
        page: parseInt(page),
        per: parseInt(perPage),
        total
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Trash operations - MUST be before /:fileId route
router.get('/trash', authenticate, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT * FROM files
      WHERE owner_id = ? AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `).all(req.user.id);

    res.json(files.map(f => ({
      ...f,
      isFavorite: !!f.is_favorite,
      mimeType: f.mime_type,
      storageKey: f.storage_key,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      deletedAt: f.deleted_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get trash' });
  }
});

// Get single file
router.get('/:fileId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      ...file,
      isFavorite: !!file.is_favorite,
      mimeType: file.mime_type,
      storageKey: file.storage_key,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Upload file
router.post('/', authenticate, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folderId } = req.body;
    const fileId = uuidv4();
    const filePath = req.file.path;

    // Calculate checksum
    const fileBuffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Get mime type
    const mimeType = mime.lookup(req.file.originalname) || 'application/octet-stream';

    // Determine path
    let folderPath = '/';
    if (folderId) {
      const folder = db.prepare('SELECT path, name FROM folders WHERE id = ? AND owner_id = ?').get(folderId, req.user.id);
      if (folder) {
        folderPath = folder.path === '/' ? `/${folder.name}` : `${folder.path}/${folder.name}`;
      }
    }

    // Insert file record
    db.prepare(`
      INSERT INTO files (id, name, owner_id, folder_id, path, storage_key, size, mime_type, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      req.file.originalname,
      req.user.id,
      folderId || null,
      folderPath,
      req.file.filename,
      req.file.size,
      mimeType,
      checksum
    );

    // Update user storage
    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(req.file.size, req.user.id);

    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

    res.status(201).json({
      ...file,
      isFavorite: !!file.is_favorite,
      mimeType: file.mime_type,
      storageKey: file.storage_key,
      createdAt: file.created_at,
      updatedAt: file.updated_at
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download file (supports token in query string for img tags)
router.get('/:fileId/download', (req, res) => {
  try {
    // Try to get user from token in query or header
    let userId;
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        console.error('Token verification failed:', e.message);
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, userId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = join(storagePath, userId, file.storage_key);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Update file
router.put('/:fileId', authenticate, (req, res) => {
  try {
    const { name } = req.body;
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (name) {
      db.prepare(`
        UPDATE files SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(name, req.params.fileId);
    }

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);

    res.json({
      ...updated,
      isFavorite: !!updated.is_favorite,
      mimeType: updated.mime_type,
      storageKey: updated.storage_key,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete file (soft delete)
router.delete('/:fileId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.fileId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Restore file
router.post('/:fileId/restore', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found in trash' });
    }

    db.prepare(`
      UPDATE files SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.fileId);

    const restored = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);

    res.json({
      ...restored,
      isFavorite: !!restored.is_favorite,
      mimeType: restored.mime_type,
      storageKey: restored.storage_key,
      createdAt: restored.created_at,
      updatedAt: restored.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Restore failed' });
  }
});

// Permanent delete
router.delete('/:fileId/permanent', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ?
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete physical file
    const filePath = join(storagePath, req.user.id, file.storage_key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user storage
    db.prepare('UPDATE users SET storage_used = storage_used - ? WHERE id = ?').run(file.size, req.user.id);

    // Delete from database
    db.prepare('DELETE FROM files WHERE id = ?').run(req.params.fileId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Permanent delete failed' });
  }
});

// Toggle favorite
router.post('/:fileId/favorite', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE files SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(file.is_favorite ? 0 : 1, req.params.fileId);

    res.json({ isFavorite: !file.is_favorite });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Get favorites
router.get('/favorites/list', authenticate, (req, res) => {
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
        ...f,
        isFavorite: true,
        mimeType: f.mime_type,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      folders: folders.map(f => ({
        ...f,
        isFavorite: true,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Copy file
router.post('/:fileId/copy', authenticate, (req, res) => {
  try {
    const { targetFolderId } = req.body;
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Copy physical file
    const newStorageKey = `${uuidv4()}${path.extname(file.name)}`;
    const srcPath = join(storagePath, req.user.id, file.storage_key);
    const destPath = join(storagePath, req.user.id, newStorageKey);
    fs.copyFileSync(srcPath, destPath);

    // Create new file record
    const newFileId = uuidv4();
    db.prepare(`
      INSERT INTO files (id, name, owner_id, folder_id, path, storage_key, size, mime_type, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newFileId,
      `Copy of ${file.name}`,
      req.user.id,
      targetFolderId || file.folder_id,
      file.path,
      newStorageKey,
      file.size,
      file.mime_type,
      file.checksum
    );

    // Update storage
    db.prepare('UPDATE users SET storage_used = storage_used + ? WHERE id = ?').run(file.size, req.user.id);

    const newFile = db.prepare('SELECT * FROM files WHERE id = ?').get(newFileId);

    res.status(201).json({
      ...newFile,
      isFavorite: !!newFile.is_favorite,
      mimeType: newFile.mime_type,
      createdAt: newFile.created_at,
      updatedAt: newFile.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Copy failed' });
  }
});

// Move file
router.post('/:fileId/move', authenticate, (req, res) => {
  try {
    const { targetFolderId } = req.body;
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE files SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(targetFolderId || null, req.params.fileId);

    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.fileId);

    res.json({
      ...updated,
      isFavorite: !!updated.is_favorite,
      mimeType: updated.mime_type,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Move failed' });
  }
});

// Get file versions
router.get('/:fileId/versions', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const versions = db.prepare(`
      SELECT * FROM file_versions
      WHERE file_id = ?
      ORDER BY version_number DESC
    `).all(req.params.fileId);

    res.json(versions.map(v => ({
      id: v.id,
      fileID: v.file_id,
      versionNumber: v.version_number,
      size: v.size,
      checksum: v.checksum,
      changeSummary: v.change_summary,
      createdByID: v.created_by,
      createdAt: v.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

// Get file comments
router.get('/:fileId/comments', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const comments = db.prepare(`
      SELECT c.*, u.name as user_name FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.file_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.fileId);

    res.json(comments.map(c => ({
      id: c.id,
      userID: c.user_id,
      userName: c.user_name,
      fileID: c.file_id,
      content: c.content,
      isResolved: !!c.is_resolved,
      parentID: c.parent_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Add comment to file
router.post('/:fileId/comments', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    const file = db.prepare(`
      SELECT * FROM files
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const commentId = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, file_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `).run(commentId, req.params.fileId, req.user.id, content);

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    res.status(201).json({
      id: comment.id,
      userID: comment.user_id,
      userName: comment.user_name,
      fileID: comment.file_id,
      content: comment.content,
      isResolved: false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
