import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

// POST /optimize - Optimize database (VACUUM + ANALYZE)
router.post('/optimize', (req, res) => {
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM');
    db.exec('ANALYZE');

    // Get database size info
    const pageCount = db.pragma('page_count', { simple: true });
    const pageSize = db.pragma('page_size', { simple: true });
    const sizeBytes = pageCount * pageSize;

    res.json({
      success: true,
      message: 'Database optimized',
      size: sizeBytes,
      sizeFormatted: sizeBytes > 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(sizeBytes / 1024).toFixed(2)} KB`,
    });
  } catch (error) {
    console.error('DB optimize error:', error);
    res.status(500).json({ error: 'Failed to optimize database' });
  }
});

// GET /stats - Get database statistics
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const pageCount = db.pragma('page_count', { simple: true });
    const pageSize = db.pragma('page_size', { simple: true });
    const sizeBytes = pageCount * pageSize;

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all();

    const tableStats = tables.map(({ name }) => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get();
      return { table: name, rows: count.count };
    });

    res.json({
      size: sizeBytes,
      sizeFormatted: sizeBytes > 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(sizeBytes / 1024).toFixed(2)} KB`,
      tables: tableStats,
    });
  } catch (error) {
    console.error('DB stats error:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

export default router;
