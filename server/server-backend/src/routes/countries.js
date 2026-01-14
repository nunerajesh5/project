const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/countries - List all active countries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT country_id, name, code, is_active, created_at, updated_at
       FROM countries 
       WHERE is_active = true
       ORDER BY name ASC`
    );
    res.json({ countries: result.rows });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/countries/:id - Get specific country
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT country_id, name, code, is_active, created_at, updated_at
       FROM countries 
       WHERE country_id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    res.json({ country: result.rows[0] });
  } catch (error) {
    console.error('Error fetching country:', error);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

// GET /api/countries/:id/states - Get states for a specific country
router.get('/:id/states', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify country exists
    const country = await pool.query('SELECT country_id FROM countries WHERE country_id = $1', [id]);
    if (country.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    const result = await pool.query(
      `SELECT state_id, name, code, country_id, is_active, created_at, updated_at
       FROM states 
       WHERE country_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [id]
    );
    
    res.json({ states: result.rows });
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

module.exports = router;
