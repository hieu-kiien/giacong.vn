const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS view engine and configure views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Serve assets folder as static files
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Enable body-parser (urlencoded and JSON)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Path helpers
const metadataPath = path.join(__dirname, '..', 'metadata.json');
const productsPath = path.join(__dirname, '..', 'data', 'products.json');
const servicesPath = path.join(__dirname, '..', 'data', 'services.json');
const submissionsPath = path.join(__dirname, '..', 'data', 'submissions.json');

// In-memory data loading
let metadata = { pages: [] };
let products = [];
let services = [];

try {
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading metadata.json:', err);
}

try {
  if (fs.existsSync(productsPath)) {
    products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading products.json:', err);
}

try {
  if (fs.existsSync(servicesPath)) {
    services = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading services.json:', err);
}

// Helper to clean external URLs to local paths
function cleanUrl(url) {
  if (!url) return '#';
  if (url.startsWith('https://giacong.vn')) {
    let relativePath = url.replace('https://giacong.vn', '');
    if (relativePath.endsWith('/')) {
      relativePath = relativePath.slice(0, -1);
    }
    if (relativePath === '') {
      return '/';
    }
    return relativePath;
  }
  return url;
}

// Search helper
function performSearch(query) {
  if (!query) return [];
  const normalizedQuery = query.toLowerCase().trim();

  // Search products
  const matchedProducts = products.filter(p =>
    p.name && p.name.toLowerCase().includes(normalizedQuery)
  ).map(p => ({
    type: 'product',
    name: p.name,
    image: p.image,
    price: p.price || 'Liên hệ',
    href: cleanUrl(p.href)
  }));

  // Search services
  const matchedServices = services.filter(s =>
    s.text && s.text.toLowerCase().includes(normalizedQuery)
  ).map(s => ({
    type: 'service',
    name: s.text,
    image: null,
    price: 'Liên hệ',
    href: cleanUrl(s.href)
  }));

  return [...matchedProducts, ...matchedServices];
}

// Form submission handler
function handleSubmission(req, res) {
  const formData = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const timestamp = new Date().toISOString();

  const submission = {
    timestamp,
    ip,
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers['referer'] || '',
    path: req.originalUrl,
    formData
  };

  let submissions = [];
  try {
    if (fs.existsSync(submissionsPath)) {
      const fileContent = fs.readFileSync(submissionsPath, 'utf8');
      submissions = JSON.parse(fileContent);
      if (!Array.isArray(submissions)) {
        submissions = [];
      }
    }
  } catch (err) {
    console.error('Error reading submissions.json:', err);
  }

  submissions.push(submission);

  try {
    fs.writeFileSync(submissionsPath, JSON.stringify(submissions, null, 2), 'utf8');
    console.log('Successfully saved submission:', submission);
  } catch (err) {
    console.error('Error writing to submissions.json:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }

  // Handle standard redirect or JSON response
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
    return res.json({
      success: true,
      message: 'Cảm ơn bạn! Yêu cầu của bạn đã được gửi thành công.',
      status: 'mail_sent'
    });
  } else {
    const redirectUrl = req.headers['referer'] || '/';
    return res.send(`
      <script>
        alert('Cảm ơn bạn! Yêu cầu của bạn đã được gửi thành công.');
        window.location.href = "${redirectUrl}";
      </script>
    `);
  }
}

// POST Routes for contact form submissions
app.post('/', handleSubmission);
app.post('/api/contact', handleSubmission);

// GET /search route
app.get('/search', (req, res) => {
  const query = req.query.s || '';
  const results = performSearch(query);
  res.render('pages/search', {
    title: `Kết quả tìm kiếm cho "${query}" - Giacong.vn`,
    description: `Kết quả tìm kiếm cho từ khóa "${query}" tại Giacong.vn.`,
    slug: 'search',
    query: query,
    results: results
  });
});

// GET / homepage route (also acts as fallback search for /?s=query)
app.get('/', (req, res) => {
  const query = req.query.s;
  if (query !== undefined) {
    const results = performSearch(query);
    return res.render('pages/search', {
      title: `Kết quả tìm kiếm cho "${query}" - Giacong.vn`,
      description: `Kết quả tìm kiếm cho từ khóa "${query}" tại Giacong.vn.`,
      slug: 'search',
      query: query,
      results: results
    });
  }

  const homePage = metadata.pages.find(p => p.slug === 'home');
  res.render('pages/home', {
    title: homePage ? homePage.title : 'Giacong.vn - Đối Tác Gia Công OEM/ODM & Private Label Hàng Đầu',
    description: homePage ? homePage.description : '',
    slug: 'home'
  });
});

// GET dynamic slug routing
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  const decodedSlug = decodeURIComponent(slug);
  const encodedSlug = encodeURIComponent(slug);

  // Find page match in metadata
  const matchedPage = metadata.pages.find(p =>
    p.slug === slug ||
    p.slug === decodedSlug ||
    p.slug === encodedSlug ||
    decodeURIComponent(p.slug) === decodedSlug
  );

  let templateName = null;
  let pageMeta = { title: 'Giacong.vn', description: '', slug: slug };

  if (matchedPage) {
    templateName = matchedPage.slug;
    pageMeta = {
      title: matchedPage.title || 'Giacong.vn',
      description: matchedPage.description || '',
      slug: matchedPage.slug
    };
  } else {
    // Check if EJS file exists on disk
    const possibleNames = [slug, decodedSlug, encodedSlug];
    for (const name of possibleNames) {
      const filePath = path.join(__dirname, '..', 'views', 'pages', `${name}.ejs`);
      if (fs.existsSync(filePath)) {
        templateName = name;
        break;
      }
    }
  }

  if (templateName) {
    return res.render('pages/' + templateName, pageMeta);
  }

  // Fallthrough to 404
  next();
});

// POST dynamic slug routing (for form actions submitting to page paths)
app.post('/:slug', handleSubmission);

// 404 Page Not Found handler
app.use((req, res) => {
  res.status(404).render('pages/nuoc-trai-cay', {
    title: 'Page Not Found - Giacong.vn',
    description: 'Trang bạn yêu cầu không tìm thấy.',
    slug: '404'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
