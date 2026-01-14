const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');

// Mapping of old column names to new ones
const replacements = [
  // Tasks table
  { pattern: /\bt\.id\b(?!\s*as)/g, replacement: 't.task_id' },
  { pattern: /\bt\.title\b/g, replacement: 't.task_name' },
  { pattern: /\bt\.due_date\b/g, replacement: 't.start_date' },
  
  // Projects table  
  { pattern: /\bp\.id\b(?!\s*as)/g, replacement: 'p.project_id' },
  { pattern: /\bp\.name\b/g, replacement: 'p.project_name' },
  { pattern: /\bp\.budget\b/g, replacement: 'p.estimated_value' },
  { pattern: /\bp\.location\b/g, replacement: 'p.project_location' },
  
  // Users/Employees table (employees table doesn't exist, it's users)
  { pattern: /\be\.id\b(?!\s*as)/g, replacement: 'u.user_id' },
  { pattern: /\be\.email\b(?!_id)/g, replacement: 'u.email_id' },
  { pattern: /\be\.department\b/g, replacement: 'u.department_id' },
  { pattern: /\be\.employee_id\b/g, replacement: 'u.user_id' },
  
  // Table references in FROM/JOIN
  { pattern: /\bJOIN employees e\b/g, replacement: 'JOIN users u' },
  { pattern: /\bLEFT JOIN employees e\b/g, replacement: 'LEFT JOIN users u' },
  { pattern: /\bemployees e ON/g, replacement: 'users u ON' },
  
  // Clients table
  { pattern: /\bc\.id\b(?!\s*as)/g, replacement: 'c.id' }, // clients still uses id
];

// Get all .js files in routes directory
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

console.log(`Processing ${files.length} route files...\n`);

let totalChanges = 0;

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fileChanges = 0;
  
  replacements.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      fileChanges += matches.length;
      content = content.replace(pattern, replacement);
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${file}: ${fileChanges} changes`);
    totalChanges += fileChanges;
  }
});

console.log(`\n✅ Total: ${totalChanges} changes across ${files.length} files`);
