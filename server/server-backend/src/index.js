const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { securityHeaders, requestLogger, sanitizeInput, errorHandler, generalLimiter, authLimiter } = require('./middleware/security');
const { auditLog, createAuditTable } = require('./middleware/audit');

const routes = require('./routes');
// Ensure DB pools are initialized and allow optional secondary ping
const { secondary } = require('./config/databases');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Project Time Manager API',
      version: '1.0.0',
      description: 'A comprehensive API for managing projects, employees, clients, and time tracking',
      contact: {
        name: 'API Support',
        email: 'support@projectmanager.com'
      }
    },
    servers: [
      {
        url: `http://${HOST}:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'completed', 'on_hold', 'cancelled', 'pending'] },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            budget: { type: 'number', format: 'decimal' },
            clientId: { type: 'string', format: 'uuid' },
            clientName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Employee: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            employeeId: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            department: { type: 'string' },
            salaryType: { type: 'string', enum: ['hourly', 'daily', 'monthly'] },
            salaryAmount: { type: 'number', format: 'decimal' },
            hourlyRate: { type: 'number', format: 'decimal' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        TimeEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            employeeId: { type: 'string', format: 'uuid' },
            managerId: { type: 'string', format: 'uuid' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            durationMinutes: { type: 'integer' },
            cost: { type: 'number', format: 'decimal' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

setTimeout(() => {
  createAuditTable().catch(err => console.error('Failed to init audit table:', err.message));
}, 2000);

app.use(securityHeaders);
app.use(requestLogger);
app.use(sanitizeInput);
app.use(generalLimiter);

// CORS configuration - support multiple origins for development
const getCorsOrigin = () => {
  const clientUrl = process.env.CLIENT_URL;
  
  // If CLIENT_URL is set, use it (supports comma-separated list)
  if (clientUrl) {
    if (clientUrl.includes(',')) {
      // Multiple origins
      return clientUrl.split(',').map(url => url.trim());
    }
    return clientUrl;
  }
  
  // Default: allow common development origins
  return [
    'http://localhost:3000',
    'http://localhost:8081', // Expo web dev server
    'http://localhost:19006', // Expo web alternative port
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
  ];
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getCorsOrigin();
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // If '*' is specified, allow all
    if (allowedOrigins === '*' || allowedOrigins === true) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (Array.isArray(allowedOrigins)) {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    } else if (allowedOrigins === origin) {
      return callback(null, true);
    }
    
    // Origin not allowed
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authLimiter, auditLog, routes.auth);
app.use('/api/clients', auditLog, routes.clients);
app.use('/api/projects', auditLog, routes.projects);
app.use('/api/employees', auditLog, routes.employees);
app.use('/api/time-entries', auditLog, routes.timeEntries);
app.use('/api/tasks', auditLog, routes.tasks);
app.use('/api/dashboard', auditLog, routes.dashboard);
app.use('/api/task-uploads', auditLog, routes.taskUploads);
app.use('/api/salaries', auditLog, routes.salaries);
app.use('/api/otp', generalLimiter, auditLog, routes.otp);
app.use('/api/permissions', auditLog, routes.permissions);
app.use('/api/proof-of-work', auditLog, routes.proofOfWork);
app.use('/api/countries', auditLog, routes.countries);
app.use('/api/states', auditLog, routes.states);
app.use('/api/designations', auditLog, routes.designations);
// Public endpoints for organization onboarding (no auth)
app.use('/api/organizations', routes.organizations);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`API Documentation available at http://${HOST}:${PORT}/api-docs`);
  // Warm up secondary DB (project_registry) if configured, so connection log is visible
  if (secondary) {
    secondary
      .query('SELECT current_database()')
      .then((r) => {
        const dbName = r?.rows?.[0]?.current_database || 'project_registry';
        console.log(`Connected to PostgreSQL database: ${dbName}`);
      })
      .catch((e) => console.warn('Secondary DB ping failed:', e.message));
  }
});

module.exports = app;

