import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// List tags
router.get('/', authenticate, (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT * FROM tags WHERE owner_id = ? ORDER BY name ASC
    `).all(req.user.id);

    res.json(tags.map(t => ({
      ...t,
      createdAt: t.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

// Create tag
router.post('/', authenticate, (req, res) => {
  try {
    const { name, color = '#3b82f6' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    // Check if tag already exists
    const existing = db.prepare(`
      SELECT * FROM tags WHERE name = ? AND owner_id = ?
    `).get(name, req.user.id);

    if (existing) {
      return res.status(409).json({ error: 'Tag already exists' });
    }

    const tagId = uuidv4();
    db.prepare(`
      INSERT INTO tags (id, name, color, owner_id) VALUES (?, ?, ?, ?)
    `).run(tagId, name, color, req.user.id);

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);

    res.status(201).json({
      ...tag,
      createdAt: tag.created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/:tagId', authenticate, (req, res) => {
  try {
    const { name, color } = req.body;

    const tag = db.prepare(`
      SELECT * FROM tags WHERE id = ? AND owner_id = ?
    `).get(req.params.tagId, req.user.id);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (color) {
      updates.push('color = ?');
      params.push(color);
    }

    if (updates.length > 0) {
      params.push(req.params.tagId);
      db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.tagId);

    res.json({
      ...updated,
      createdAt: updated.created_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag
router.delete('/:tagId', authenticate, (req, res) => {
  try {
    const tag = db.prepare(`
      SELECT * FROM tags WHERE id = ? AND owner_id = ?
    `).get(req.params.tagId, req.user.id);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    db.prepare('DELETE FROM file_tags WHERE tag_id = ?').run(req.params.tagId);
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.tagId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// Add tag to file
router.post('/file/:fileId/tag/:tagId', authenticate, (req, res) => {
  try {
    const file = db.prepare(`
      SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const tag = db.prepare(`
      SELECT * FROM tags WHERE id = ? AND owner_id = ?
    `).get(req.params.tagId, req.user.id);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check if already tagged
    const existing = db.prepare(`
      SELECT * FROM file_tags WHERE file_id = ? AND tag_id = ?
    `).get(req.params.fileId, req.params.tagId);

    if (!existing) {
      db.prepare(`
        INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)
      `).run(req.params.fileId, req.params.tagId);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Remove tag from file
router.delete('/file/:fileId/tag/:tagId', authenticate, (req, res) => {
  try {
    db.prepare(`
      DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?
    `).run(req.params.fileId, req.params.tagId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Get files by tag
router.get('/:tagId/files', authenticate, (req, res) => {
  try {
    const files = db.prepare(`
      SELECT f.* FROM files f
      JOIN file_tags ft ON f.id = ft.file_id
      WHERE ft.tag_id = ? AND f.owner_id = ? AND f.deleted_at IS NULL
      ORDER BY f.name ASC
    `).all(req.params.tagId, req.user.id);

    res.json(files.map(f => ({
      ...f,
      isFavorite: !!f.is_favorite,
      mimeType: f.mime_type,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get files' });
  }
});

export default router;
