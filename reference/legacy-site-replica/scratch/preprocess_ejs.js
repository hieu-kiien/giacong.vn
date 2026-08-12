const fs = require('fs');
const path = require('path');

const metadataPath = path.join(__dirname, '..', 'metadata.json');
const pagesDir = path.join(__dirname, '..', 'views', 'pages');

if (!fs.existsSync(metadataPath)) {
  console.error('metadata.json not found!');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

metadata.pages.forEach(page => {
  const ejsPath = path.join(pagesDir, `${page.slug}.ejs`);
  if (!fs.existsSync(ejsPath)) {
    console.log(`Warning: Template file not found for slug "${page.slug}" at ${ejsPath}`);
    return;
  }

  let content = fs.readFileSync(ejsPath, 'utf8');

  // Replace <title>...</title>
  content = content.replace(/<title>[^<]*<\/title>/gi, '<title><%= typeof title !== "undefined" ? title : "" %></title>');

  // Replace <meta name="description" content="..." /> or <meta name="description" content="...">
  content = content.replace(/<meta\s+name="description"\s+content="[^"]*"/gi, '<meta name="description" content="<%= typeof description !== "undefined" ? description : \"\" %>"');
  content = content.replace(/<meta\s+content="[^"]*"\s+name="description"/gi, '<meta name="description" content="<%= typeof description !== "undefined" ? description : \"\" %>"');

  // Replace OpenGraph title/description
  content = content.replace(/<meta\s+property="og:title"\s+content="[^"]*"/gi, '<meta property="og:title" content="<%= typeof title !== "undefined" ? title : \"\" %>"');
  content = content.replace(/<meta\s+property="og:description"\s+content="[^"]*"/gi, '<meta property="og:description" content="<%= typeof description !== "undefined" ? description : \"\" %>"');

  // Replace Twitter title/description
  content = content.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/gi, '<meta name="twitter:title" content="<%= typeof title !== "undefined" ? title : \"\" %>"');
  content = content.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/gi, '<meta name="twitter:description" content="<%= typeof description !== "undefined" ? description : \"\" %>"');

  fs.writeFileSync(ejsPath, content, 'utf8');
  console.log(`Preprocessed ${page.slug}.ejs`);
});

console.log('Preprocessing completed successfully!');
