const http = require('http');

http.get('http://localhost:3000/schedule/64b00f31-933c-47df-ba8e-98631d0a524a', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Body length:', data.length);
    console.log('First 500 chars of body:');
    console.log(data.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
