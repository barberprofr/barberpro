const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/salons/main/reports/global-breakdown?date=2026-02-28',
    method: 'GET',
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', res.statusCode, data.substring(0, 500)));
});
req.on('error', error => console.error(error));
req.end();
