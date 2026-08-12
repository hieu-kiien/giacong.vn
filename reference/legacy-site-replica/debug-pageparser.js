const { getPageData } = require('./frontend/src/utils/pageParser');

(async () => {
  // Mock environment variables to match Next.js server runtime
  process.env.LARAVEL_API_URL = 'http://127.0.0.1:8002';
  
  console.log('Running getPageData("home")...');
  const data = await getPageData('home');
  
  if (!data) {
    console.log('No data returned!');
    return;
  }
  
  console.log('Data keys:', Object.keys(data));
  console.log('beforeHeader length:', data.beforeHeader.length);
  console.log('content length:', data.content.length);
  console.log('afterFooter length:', data.afterFooter.length);
  console.log('bodyClass:', data.bodyClass);
  console.log('title:', data.title);
  console.log('description:', data.description);

  console.log('\nDoes content contain text-34?', data.content.includes('text-34'));
  console.log('Does content contain "Giải pháp gia công"?', data.content.includes('Giải pháp gia công'));
})();
