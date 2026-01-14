const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { secondary: registryPool } = require('../config/databases');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // If token was created from employees_registry (organization users), check there first
    if (decoded.source === 'registry' && registryPool) {
      try {
        const registryResult = await registryPool.query(
          `SELECT id, employee_email as email, employee_name, role, organization_id, organization_name, is_active
           FROM employees_registry WHERE id = $1`,
          [decoded.userId]
        );
        
        if (registryResult.rows.length > 0) {
          const row = registryResult.rows[0];
          if (!row.is_active) {
            return res.status(401).json({ error: 'Invalid or inactive user' });
          }
          
          // Parse name into first and last name
          const nameParts = (row.employee_name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          req.user = {
            id: row.id,
            email: row.email,
            first_name: firstName,
            last_name: lastName,
            role: row.role,
            is_active: row.is_active,
            organization_id: row.organization_id,
            organization_name: row.organization_name,
            source: 'registry'
          };
          return next();
        }
      } catch (registryErr) {
        console.log('Registry user lookup failed, falling back to users table:', registryErr.message);
      }
    }
    
    // Fallback: check users table in project_time_manager (using email_id and user_id column names)
    const userResult = await pool.query('SELECT user_id as id, email_id as email, first_name, last_name, role, is_active FROM users WHERE user_id = $1', [decoded.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }
    req.user = userResult.rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

module.exports = { authenticateToken, requireRole };

