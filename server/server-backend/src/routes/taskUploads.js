const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();
router.use(authenticateToken);

const uploadDir = path.resolve(__dirname, '../../uploads/task-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    cb(null, `${timestamp}-${random}-${name}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt/;
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and office documents are allowed'), false);
    }
  }
});

// POST /api/task-uploads/upload - Upload task completion with files
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { taskId, description } = req.body;
    const files = req.files;
    const userId = req.user.id;

    // Validate required fields
    if (!taskId || !description) {
      return res.status(400).json({ error: 'Task ID and description are required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    // Verify task exists and get employee info
    const taskQuery = `
      SELECT t.task_id, t.task_name, t.assigned_to, u.user_id as employee_id, u.first_name, u.last_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.user_id
      WHERE t.task_id = $1
    `;
    const taskResult = await pool.query(taskQuery, [taskId]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    const employeeId = task.employee_id;

    // Create attachment record
    const uploadQuery = `
      INSERT INTO project_attachments (task_id, employee_id, description, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id, uploaded_at
    `;
    const uploadResult = await pool.query(uploadQuery, [taskId, employeeId, description]);
    const uploadId = uploadResult.rows[0].id;

    // Save file attachments
    const attachmentPromises = files.map(file => {
      const isImage = file.mimetype.startsWith('image/');
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      const attachmentQuery = `
        INSERT INTO task_attachments (upload_id, original_name, file_name, file_path, file_size, mime_type, file_extension, is_image)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      return pool.query(attachmentQuery, [
        uploadId,
        file.originalname,
        file.filename,
        file.path,
        file.size,
        file.mimetype,
        fileExtension,
        isImage
      ]);
    });

    await Promise.all(attachmentPromises);

    res.json({
      success: true,
      uploadId: uploadId,
      filesCount: files.length,
      message: 'Task upload completed successfully'
    });

  } catch (error) {
    console.error('Error uploading task files:', error);
    
    // Clean up uploaded files if database operation failed
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      });
    }

    if (error.message.includes('Only images, PDFs, and office documents are allowed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to upload task files' });
  }
});

// GET /api/task-uploads/task/:taskId - Get uploads for a specific task
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // Check if pool is available
    if (!pool || typeof pool.query !== 'function') {
      console.error('Database pool is not available');
      return res.json({ uploads: [] });
    }

    // Use LEFT JOIN to handle cases where employee or task might not exist
    // Also handle the case where there are no uploads (return empty array instead of error)
    const query = `
      SELECT 
        a.id as upload_id,
        a.description,
        a.status,
        a.uploaded_at,
        COALESCE(u.first_name, '') as first_name,
        COALESCE(u.last_name, '') as last_name,
        COALESCE(t.task_name, '') as task_title
      FROM project_attachments a
      LEFT JOIN users u ON a.employee_id = u.user_id
      LEFT JOIN tasks t ON a.task_id = t.task_id
      WHERE a.task_id = $1
      ORDER BY a.uploaded_at DESC
    `;

    const result = await pool.query(query, [taskId]);
    res.json({ uploads: result.rows || [] });

  } catch (error) {
    // Log the error for debugging but return empty array to client
    console.error('Error fetching task uploads:', error.message || error);
    // Return empty array instead of error (task might not have uploads or table might not exist)
    res.json({ uploads: [] });
  }
});

// GET /api/task-uploads/:uploadId/attachments - Get attachments for a specific upload
router.get('/:uploadId/attachments', async (req, res) => {
  try {
    const { uploadId } = req.params;

    // Check if pool is available
    if (!pool || typeof pool.query !== 'function') {
      console.error('Database pool is not available');
      return res.json({ attachments: [] });
    }

    const query = `
      SELECT 
        id,
        original_name,
        file_name,
        file_path,
        file_size,
        mime_type,
        file_extension,
        is_image,
        created_at
      FROM task_attachments
      WHERE upload_id = $1
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [uploadId]);
    res.json({ attachments: result.rows || [] });

  } catch (error) {
    // Log the error for debugging but return empty array to client
    console.error('Error fetching attachments:', error.message || error);
    // Return empty array instead of error (upload might not have attachments or table might not exist)
    res.json({ attachments: [] });
  }
});

// GET /api/task-uploads/employee/:employeeId - Get uploads by employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        a.id as upload_id,
        a.description,
        a.status,
        a.uploaded_at,
        t.task_name as task_title,
        p.project_name as project_name
      FROM project_attachments a
      JOIN tasks t ON a.task_id = t.task_id
      JOIN projects p ON t.project_id = p.project_id
      WHERE a.employee_id = $1
      ORDER BY a.uploaded_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM project_attachments
      WHERE employee_id = $1
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, [employeeId, limit, offset]),
      pool.query(countQuery, [employeeId])
    ]);

    res.json({
      uploads: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (error) {
    console.error('Error fetching employee uploads:', error);
    res.status(500).json({ error: 'Failed to fetch employee uploads' });
  }
});

// PUT /api/task-uploads/:uploadId/review - Review an upload (approve/reject)
router.put('/:uploadId/review', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { status } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either approved or rejected' });
    }

    const query = `
      UPDATE project_attachments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, status, uploaded_at
    `;

    const result = await pool.query(query, [status, uploadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json({ 
      success: true, 
      upload: result.rows[0],
      message: `Upload ${status} successfully`
    });

  } catch (error) {
    console.error('Error reviewing upload:', error);
    res.status(500).json({ error: 'Failed to review upload' });
  }
});

module.exports = router;

