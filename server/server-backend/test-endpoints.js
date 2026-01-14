const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NWJmNDEyZi1iY2NlLTQ3NWEtOTM0MC05NDQ5NDg2NGU2OTEiLCJzb3VyY2UiOiJsb2NhbCIsImlhdCI6MTc2ODEyNzgzOSwiZXhwIjoxNzY4NzMyNjM5fQ.GcO_FGVrAGSx5LNIBrYgm5HSD7zR5atSlLmpu9QevWQ';

async function testEndpoints() {
  console.log('Testing endpoints...\n');
  
  // Test clients
  try {
    const clients = await axios.get('http://localhost:5000/api/clients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Clients:', clients.data.total, 'total,', clients.data.clients.length, 'returned');
    if (clients.data.clients.length > 0) {
      console.log('   First client:', clients.data.clients[0].name);
    }
  } catch (e) {
    console.log('❌ Clients error:', e.response?.data || e.message);
  }
  
  // Test employees
  try {
    const employees = await axios.get('http://localhost:5000/api/employees', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Employees:', employees.data.total, 'total,', employees.data.employees.length, 'returned');
    if (employees.data.employees.length > 0) {
      console.log('   First employee:', employees.data.employees[0].first_name, employees.data.employees[0].last_name);
    }
  } catch (e) {
    console.log('❌ Employees error:', e.response?.data || e.message);
  }
  
  // Test projects
  try {
    const projects = await axios.get('http://localhost:5000/api/projects', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Projects:', projects.data.total, 'total,', projects.data.projects.length, 'returned');
  } catch (e) {
    console.log('❌ Projects error:', e.response?.data || e.message);
  }
}

testEndpoints();
