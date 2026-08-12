const { URL } = require('url');

function fetchUrl(targetUrl, timeoutMs = 10000, redirectCount = 0) {
  return new Promise((resolve) => {
    if (redirectCount > 5) {
      resolve({ statusCode: 0, error: 'Too many redirects', finalUrl: targetUrl });
      return;
    }

    const parsedUrl = new URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: timeoutMs
    };

    const protocol = parsedUrl.protocol === 'https:' ? require('https') : require('http');

    const req = protocol.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const host = parsedUrl.host;
          const proto = parsedUrl.protocol;
          if (redirectUrl.startsWith('/')) {
            redirectUrl = `${proto}//${host}${redirectUrl}`;
          } else {
            redirectUrl = `${proto}//${host}/${redirectUrl}`;
          }
        }
        console.log(`Redirecting to: ${redirectUrl}`);
        resolve(fetchUrl(redirectUrl, timeoutMs, redirectCount + 1));
        return;
      }

      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body,
          finalUrl: targetUrl
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'Timeout', finalUrl: targetUrl });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message, finalUrl: targetUrl });
    });

    req.end();
  });
}

fetchUrl('https://giacong.vn/gioi-thieu-ve-gia-cong')
  .then(res => {
    console.log(`Final Status: ${res.statusCode}`);
    console.log(`Final URL: ${res.finalUrl}`);
    console.log(`Body Length: ${res.body ? res.body.length : 0}`);
  });
