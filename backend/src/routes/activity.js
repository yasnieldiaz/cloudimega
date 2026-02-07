import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../models/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// List activity logs
router.get('/', authenticate, (req, res) => {
  try {
    const { action, resourceType, page = 1, perPage = 50 } = req.query;
    const offset = (page - 1) * perPage;

    let query = 'SELECT * FROM activity_logs WHERE user_id = ?';
    const params = [req.user.id];

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(perPage), parseInt(offset));

    const logs = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM activity_logs WHERE user_id = ?';
    const countParams = [req.user.id];

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }

    if (resourceType) {
      countQuery += ' AND resource_type = ?';
      countParams.push(resourceType);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      items: logs.map(l => ({
        id: l.id,
        action: l.action,
        resourceType: l.resource_type,
        resourceId: l.resource_id,
        resourceName: l.resource_name,
        details: l.details ? JSON.parse(l.details) : null,
        ipAddress: l.ip_address,
        createdAt: l.created_at
      })),
      metadata: {
        page: parseInt(page),
        per: parseInt(perPage),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get activity logs' });
  }
});

// Log activity (internal use)
export function logActivity(userId, action, resourceType, resourceId, resourceName, details, ipAddress) {
  try {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO activity_logs (id, user_id, action, resource_type, resource_id, resource_name, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, resourceType, resourceId, resourceName, details ? JSON.stringify(details) : null, ipAddress);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export default router;
