const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/designations - List all active designations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT designation_id, name, description, department_id, is_active, created_at, updated_at
       FROM designations 
       WHERE is_active = true
       ORDER BY name ASC`
    );
    res.json({ designations: result.rows });
  } catch (error) {
    console.error('Error fetching designations:', error);
    res.status(500).json({ error: 'Failed to fetch designations' });
  }
});

// GET /api/designations/:id - Get specific designation
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT designation_id, name, description, department_id, is_active, created_at, updated_at
       FROM designations 
       WHERE designation_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designation not found' });
    }
    
    res.json({ designation: result.rows[0] });
  } catch (error) {
    console.error('Error fetching designation:', error);
    res.status(500).json({ error: 'Failed to fetch designation' });
  }
});

module.exports = router;
