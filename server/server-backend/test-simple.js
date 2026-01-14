const http = require('http');

function testAPI() {
  const options = {
    hostname: '10.0.2.2',
    port: 5000,
    path: '/api/projects',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('Testing GET /api/projects...');
  
  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('✅ GET /api/projects SUCCESS');
        console.log(`   Total projects: ${result.total}`);
        
        if (result.projects && result.projects.length > 0) {
          const project = result.projects[0];
          console.log(`\nTesting GET /api/projects/${project.project_id}/team...`);
          
          testTeamEndpoint(project.project_id, project.project_name);
        }
      } else {
        console.log(`❌ Error: ${res.statusCode}`);
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.end();
}

function testTeamEndpoint(projectId, projectName) {
  const options = {
    hostname: '10.0.2.2',
    port: 5000,
    path: `/api/projects/${projectId}/team`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log(`✅ GET /api/projects/${projectId}/team SUCCESS`);
        console.log(`   Project: ${projectName}`);
        console.log(`   Team members: ${result.teamMembers?.length || 0}`);
        
        if (result.teamMembers && result.teamMembers.length > 0) {
          result.teamMembers.forEach((member, idx) => {
            console.log(`   ${idx + 1}. ${member.first_name} ${member.last_name} (${member.email})`);
          });
        }
        
        console.log('\n✅ All tests passed!');
      } else {
        console.log(`❌ Error: ${res.statusCode}`);
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.end();
}

// Wait a bit for server to be ready
setTimeout(testAPI, 1000);
