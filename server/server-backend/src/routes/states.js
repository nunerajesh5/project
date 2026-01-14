const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/states - List all active states (optionally filtered by country)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { country_id } = req.query;
    
    let query = `
      SELECT s.state_id, s.name, s.code, s.country_id, s.is_active, s.created_at, s.updated_at,
             c.name as country_name
      FROM states s
      LEFT JOIN countries c ON s.country_id = c.country_id
      WHERE s.is_active = true
    `;
    const params = [];
    
    if (country_id) {
      params.push(country_id);
      query += ` AND s.country_id = $${params.length}`;
    }
    
    query += ' ORDER BY s.name ASC';
    
    const result = await pool.query(query, params);
    res.json({ states: result.rows });
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

// GET /api/states/:id - Get specific state
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT s.state_id, s.name, s.code, s.country_id, s.is_active, s.created_at, s.updated_at,
              c.name as country_name
       FROM states s
       LEFT JOIN countries c ON s.country_id = c.country_id
       WHERE s.state_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'State not found' });
    }
    
    res.json({ state: result.rows[0] });
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

module.exports = router;
