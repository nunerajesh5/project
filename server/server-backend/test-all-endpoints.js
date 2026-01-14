const http = require('http');

function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testEndpoints() {
  try {
    console.log('🔐 Testing Login...');
    const loginResp = await makeRequest('POST', '/api/auth/login', null, {
      email: 'admin@company.com',
      password: 'password123'
    });
    
    if (loginResp.status !== 200) {
      console.error('❌ Login failed:', loginResp.status, loginResp.data);
      return;
    }
    
    const token = loginResp.data.token;
    console.log('✅ Login successful\n');

    console.log('📊 Testing Projects...');
    const projectsResp = await makeRequest('GET', '/api/projects', token);
    console.log('Status:', projectsResp.status);
    console.log('Total projects:', projectsResp.data.pagination?.total);
    console.log('Projects returned:', projectsResp.data.projects?.length);
    if (projectsResp.data.projects && projectsResp.data.projects.length > 0) {
      console.log('First project:', projectsResp.data.projects[0].name);
    }
    console.log('');

    console.log('👥 Testing Clients...');
    const clientsResp = await makeRequest('GET', '/api/clients', token);
    console.log('Status:', clientsResp.status);
    console.log('Clients returned:', clientsResp.data.clients?.length);
    if (clientsResp.data.clients && clientsResp.data.clients.length > 0) {
      console.log('First client:', clientsResp.data.clients[0].name);
    }
    console.log('');

    console.log('🧑‍💼 Testing Employees...');
    const employeesResp = await makeRequest('GET', '/api/employees', token);
    console.log('Status:', employeesResp.status);
    console.log('Total employees:', employeesResp.data.total);
    console.log('Employees returned:', employeesResp.data.employees?.length);
    if (employeesResp.data.employees && employeesResp.data.employees.length > 0) {
      console.log('First employee:', employeesResp.data.employees[0].first_name, employeesResp.data.employees[0].last_name);
    }
    console.log('');

    console.log('🏢 Testing Organizations...');
    const orgResp = await makeRequest('GET', '/api/organizations/my-organization', token);
    console.log('Status:', orgResp.status);
    if (orgResp.data.organization) {
      console.log('Organization:', orgResp.data.organization.name);
      console.log('Join code:', orgResp.data.organization.join_code);
    }
    console.log('');

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEndpoints();
