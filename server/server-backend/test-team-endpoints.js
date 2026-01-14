const axios = require('axios');

async function testTeamEndpoints() {
  const BASE_URL = 'http://0.0.0.0:5000/api';
  
  try {
    console.log('🔍 Testing Team Management Endpoints...\n');
    
    // Get a project ID
    console.log('1. Fetching projects...');
    const projectsRes = await axios.get(`${BASE_URL}/projects`);
    if (!projectsRes.data.projects || projectsRes.data.projects.length === 0) {
      console.log('❌ No projects found');
      return;
    }
    
    const projectId = projectsRes.data.projects[0].project_id;
    const projectName = projectsRes.data.projects[0].project_name;
    console.log(`✅ Found project: ${projectName} (${projectId})\n`);
    
    // Test GET team members
    console.log('2. Testing GET /api/projects/:id/team...');
    const teamRes = await axios.get(`${BASE_URL}/projects/${projectId}/team`);
    console.log(`✅ Team members retrieved: ${teamRes.data.teamMembers?.length || 0} members`);
    if (teamRes.data.teamMembers?.length > 0) {
      teamRes.data.teamMembers.forEach(member => {
        console.log(`   - ${member.first_name} ${member.last_name} (${member.email})`);
      });
    }
    console.log('');
    
    // Test POST - Add team member
    console.log('3. Testing POST /api/projects/:id/team...');
    
    // Get a user who's not on the team
    const usersRes = await axios.get(`${BASE_URL}/employees`);
    const currentTeamIds = teamRes.data.teamMembers?.map(m => m.user_id) || [];
    const availableUser = usersRes.data.find(u => !currentTeamIds.includes(u.user_id));
    
    if (availableUser) {
      try {
        const addRes = await axios.post(`${BASE_URL}/projects/${projectId}/team`, {
          employeeId: availableUser.user_id
        });
        console.log(`✅ Added team member: ${availableUser.first_name} ${availableUser.last_name}`);
        console.log(`   Team now has: ${addRes.data.teamMembers?.length || 'N/A'} members\n`);
        
        // Test DELETE - Remove team member
        console.log('4. Testing DELETE /api/projects/:id/team/:employeeId...');
        const deleteRes = await axios.delete(`${BASE_URL}/projects/${projectId}/team/${availableUser.user_id}`);
        console.log(`✅ Removed team member: ${deleteRes.data.message}`);
        console.log('');
      } catch (err) {
        if (err.response?.status === 409) {
          console.log('⚠️  User already on team, skipping add test');
          console.log('');
        } else {
          throw err;
        }
      }
    } else {
      console.log('⚠️  All users are already on the team, skipping add/delete tests\n');
    }
    
    // Final verification
    console.log('5. Final team verification...');
    const finalTeamRes = await axios.get(`${BASE_URL}/projects/${projectId}/team`);
    console.log(`✅ Final team count: ${finalTeamRes.data.teamMembers?.length || 0} members\n`);
    
    console.log('✅ All team management endpoints working correctly!');
    
  } catch (err) {
    console.error('❌ Error testing endpoints:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
    if (err.code) {
      console.error('Code:', err.code);
    }
  }
}

testTeamEndpoints();
