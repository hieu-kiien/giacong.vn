const https = require('https');

const options = {
  hostname: 'giacong.vn',
  path: '/gioi-thieu-ve-gia-cong',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 10000 // 10 seconds timeout
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Length: ${data.length}`);
    console.log('Preview:', data.substring(0, 200));
  });
});

req.on('timeout', () => {
  console.log('Timeout!');
  req.destroy();
});

req.on('error', (err) => {
  console.log('Error:', err.message);
});

req.end();
