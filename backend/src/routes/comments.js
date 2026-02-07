import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get comments for a file
router.get('/file/:fileId', authenticate, (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.file_id = ?
      ORDER BY c.created_at DESC
    `).all(req.params.fileId);

    res.json(comments.map(c => ({
      id: c.id,
      content: c.content,
      fileId: c.file_id,
      user: {
        id: c.user_id,
        name: c.user_name,
        email: c.user_email
      },
      createdAt: c.created_at,
      updatedAt: c.updated_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Add comment
router.post('/file/:fileId', authenticate, (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify file exists and user has access
    const file = db.prepare(`
      SELECT * FROM files WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.fileId, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const commentId = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, file_id, user_id, content) VALUES (?, ?, ?, ?)
    `).run(commentId, req.params.fileId, req.user.id, content.trim());

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      fileId: comment.file_id,
      user: {
        id: comment.user_id,
        name: comment.user_name,
        email: comment.user_email
      },
      createdAt: comment.created_at,
      updatedAt: comment.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Update comment
router.put('/:commentId', authenticate, (req, res) => {
  try {
    const { content } = req.body;

    const comment = db.prepare(`
      SELECT * FROM comments WHERE id = ? AND user_id = ?
    `).get(req.params.commentId, req.user.id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    db.prepare(`
      UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(content, req.params.commentId);

    const updated = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.params.commentId);

    res.json({
      id: updated.id,
      content: updated.content,
      fileId: updated.file_id,
      user: {
        id: updated.user_id,
        name: updated.user_name,
        email: updated.user_email
      },
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete comment
router.delete('/:commentId', authenticate, (req, res) => {
  try {
    const comment = db.prepare(`
      SELECT * FROM comments WHERE id = ? AND user_id = ?
    `).get(req.params.commentId, req.user.id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
