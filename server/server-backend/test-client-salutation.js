const http = require('http');

const data = JSON.stringify({ 
  firstName: 'TestSal', 
  lastName: 'Client', 
  email: 'testsal123@example.com', 
  salutation: 'Mr', 
  phone: '1234567890', 
  address: '123 Test St',
  gstNumber: 'GST12345678',
  onboardDate: '2024-01-15'
});

const options = { 
  hostname: 'localhost', 
  port: 5000, 
  path: '/api/clients', 
  method: 'POST', 
  headers: { 
    'Content-Type': 'application/json', 
    'Content-Length': Buffer.byteLength(data),
    'Authorization': 'Bearer demo-token' 
  } 
};

const req = http.request(options, res => { 
  let body = ''; 
  res.on('data', chunk => body += chunk); 
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', JSON.parse(body));
  });
}); 

req.on('error', e => console.error('Error:', e.message)); 
req.write(data); 
req.end();
