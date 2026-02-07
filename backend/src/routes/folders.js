import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get root folder
router.get('/root', authenticate, (req, res) => {
  try {
    let rootFolder = db.prepare(`
      SELECT * FROM folders
      WHERE owner_id = ? AND parent_id IS NULL AND path = '/' AND deleted_at IS NULL
    `).get(req.user.id);

    // Create root folder if doesn't exist
    if (!rootFolder) {
      const rootId = uuidv4();
      db.prepare(`
        INSERT INTO folders (id, name, owner_id, path)
        VALUES (?, ?, ?, ?)
      `).run(rootId, 'Root', req.user.id, '/');
      rootFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(rootId);
    }

    res.json({
      ...rootFolder,
      isFavorite: !!rootFolder.is_favorite,
      parentId: rootFolder.parent_id,
      createdAt: rootFolder.created_at,
      updatedAt: rootFolder.updated_at
    });
  } catch (error) {
    console.error('Get root folder error:', error);
    res.status(500).json({ error: 'Failed to get root folder' });
  }
});

// Get folder contents
router.get('/:folderId/contents', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const childFolders = db.prepare(`
      SELECT * FROM folders
      WHERE parent_id = ? AND owner_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `).all(req.params.folderId, req.user.id);

    // For root folder, get files where folder_id IS NULL
    const isRootFolder = folder.path === '/' && folder.parent_id === null;
    let files;
    if (isRootFolder) {
      files = db.prepare(`
        SELECT * FROM files
        WHERE (folder_id = ? OR folder_id IS NULL) AND owner_id = ? AND deleted_at IS NULL
        ORDER BY name ASC
      `).all(req.params.folderId, req.user.id);
    } else {
      files = db.prepare(`
        SELECT * FROM files
        WHERE folder_id = ? AND owner_id = ? AND deleted_at IS NULL
        ORDER BY name ASC
      `).all(req.params.folderId, req.user.id);
    }

    res.json({
      folder: {
        ...folder,
        isFavorite: !!folder.is_favorite,
        parentId: folder.parent_id,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
        childCount: childFolders.length,
        fileCount: files.length
      },
      folders: childFolders.map(f => ({
        ...f,
        isFavorite: !!f.is_favorite,
        parentId: f.parent_id,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      })),
      files: files.map(f => ({
        ...f,
        isFavorite: !!f.is_favorite,
        folderId: f.folder_id,
        mimeType: f.mime_type,
        storageKey: f.storage_key,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }))
    });
  } catch (error) {
    console.error('Get folder contents error:', error);
    res.status(500).json({ error: 'Failed to get folder contents' });
  }
});

// Create folder
router.post('/', authenticate, (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Get parent folder path
    let parentPath = '/';
    let parentName = '';
    if (parentId) {
      const parent = db.prepare(`
        SELECT * FROM folders
        WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
      `).get(parentId, req.user.id);

      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
      parentPath = parent.path === '/' ? '' : parent.path;
      parentName = parent.name === 'Root' ? '' : `/${parent.name}`;
    }

    const folderId = uuidv4();
    const folderPath = `${parentPath}${parentName}`;

    db.prepare(`
      INSERT INTO folders (id, name, owner_id, parent_id, path)
      VALUES (?, ?, ?, ?, ?)
    `).run(folderId, name, req.user.id, parentId || null, folderPath);

    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);

    res.status(201).json({
      ...folder,
      isFavorite: !!folder.is_favorite,
      parentId: folder.parent_id,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Update folder
router.put('/:folderId', authenticate, (req, res) => {
  try {
    const { name } = req.body;
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (name) {
      db.prepare(`
        UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(name, req.params.folderId);
    }

    const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.folderId);

    res.json({
      ...updated,
      isFavorite: !!updated.is_favorite,
      parentId: updated.parent_id,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Delete folder
router.delete('/:folderId', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL AND path != '/'
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found or cannot delete root' });
    }

    // Soft delete folder and contents
    db.prepare(`
      UPDATE folders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.folderId);

    db.prepare(`
      UPDATE files SET deleted_at = CURRENT_TIMESTAMP WHERE folder_id = ?
    `).run(req.params.folderId);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Toggle folder favorite
router.post('/:folderId/favorite', authenticate, (req, res) => {
  try {
    const folder = db.prepare(`
      SELECT * FROM folders
      WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `).get(req.params.folderId, req.user.id);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    db.prepare(`
      UPDATE folders SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(folder.is_favorite ? 0 : 1, req.params.folderId);

    res.json({ isFavorite: !folder.is_favorite });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

export default router;
