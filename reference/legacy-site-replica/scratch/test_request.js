const http = require('http');

http.get('http://localhost:3001/gioi-thieu-ve-gia-cong', (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(`Response length: ${data.length}`);
        if (data.includes('<!DOCTYPE html>')) {
            console.log('Successfully found doctype in response!');
        } else {
            console.log('Error: Doctype not found in response');
        }
        process.exit(0);
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
    process.exit(1);
});
