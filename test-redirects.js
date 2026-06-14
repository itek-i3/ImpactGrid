const http = require('http');
const https = require('https');
const url = require('url');

function checkUrl(targetUrl, depth = 0) {
  if (depth > 10) {
    console.log('Error: Too many redirects (potential loop)');
    return;
  }

  console.log(`\n--- Request #${depth + 1} ---`);
  console.log(`URL: ${targetUrl}`);

  const parsedUrl = url.parse(targetUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  };

  const req = client.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));

    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      let redirectUrl = res.headers.location;
      if (!redirectUrl.startsWith('http')) {
        // Resolve relative URL
        redirectUrl = url.resolve(targetUrl, redirectUrl);
      }
      checkUrl(redirectUrl, depth + 1);
    } else {
      console.log('Final URL reached or error returned.');
    }
  });

  req.on('error', (err) => {
    console.error('Request failed:', err);
  });

  req.end();
}

const startUrl = process.argv[2] || 'https://www.impact360.africa/os';
checkUrl(startUrl);
