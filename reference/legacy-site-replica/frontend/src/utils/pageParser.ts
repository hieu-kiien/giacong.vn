import fs from 'fs';
import path from 'path';
import { cache } from 'react';

export interface ParsedPage {
  beforeHeader: string;
  content: string;
  afterFooter: string;
  bodyClass: string;
  title: string;
  description: string;
}

// In-memory cache to prevent repeated synchronous disk hits
const pageCache = new Map<string, ParsedPage>();
let cachedMetadata: any = null;

export function cleanLinks(html: string): string {
  if (!html) return '';
  // Let browser resolve original source references for assets if no local equivalents exist
  let cleaned = html;
  
  // Clean escaped URL formats first so they point to the correct live url or local asset
  cleaned = cleaned.replace(/https?:\\\/\\\/[^\s"'}]+/gi, (urlMatch) => {
    return urlMatch.replace(/\\\//g, '/');
  });

  // Clean relative escaped /wp-content/ or /wp-includes/ paths
  cleaned = cleaned.replace(/(?:\\\/|\/)wp-(content|includes)[^\s"']+/gi, (match) => {
    return match.replace(/\\\//g, '/');
  });

  // Replace absolute URLs pointing to giacong.vn case-insensitively with relative paths
  // 1. If it's exactly the domain, replace with /
  cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn\/?(?=["'\s>])/gi, '/');
  // 2. Otherwise, replace other giacong.vn links, but preserve remote domain for wp-content/wp-includes as a fallback
  cleaned = cleaned.replace(/https?:\/\/(www\.)?giacong\.vn(?!\/wp-content|\/wp-includes)/gi, '');
  
  // Clean trailing slashes from page links (e.g. href="/gioi-thieu-ve-gia-cong/" -> href="/gioi-thieu-ve-gia-cong")
  cleaned = cleaned.replace(/(href="\/[^"]+?)\/(")/g, '$1$2');
  cleaned = cleaned.replace(/(href='\/[^']+?)\/(')/g, '$1$2');
  
  // Parse and normalize images
  cleaned = cleaned.replace(/<img\s+([^>]+)>/gi, (imgMatch, attributesStr) => {
    const attrRegex = /([a-zA-Z0-9\-:]+)(?:\s*=\s*(?:["']([^"']*)["']|([^\s>]+)))?/g;
    const attrs: Record<string, string> = {};
    let match;
    
    while ((match = attrRegex.exec(attributesStr)) !== null) {
      const name = match[1].toLowerCase();
      const value = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : '');
      attrs[name] = value;
    }

    let src = attrs['src'] || '';
    let dataSrc = attrs['data-src'] || '';
    let srcset = attrs['srcset'] || '';
    const dataSrcset = attrs['data-srcset'] || '';

    // Normalize double data: prefix
    if (src.startsWith('data:data:')) {
      src = src.substring(5);
    }
    if (dataSrc.startsWith('data:data:')) {
      dataSrc = dataSrc.substring(5);
    }

    const isSrcPlaceholder = src.startsWith('data:') || src === '';
    
    if (isSrcPlaceholder && dataSrc && !dataSrc.startsWith('data:')) {
      src = dataSrc;
    } else if (src && !src.startsWith('data:') && !dataSrc) {
      dataSrc = src;
    } else if (src && !src.startsWith('data:') && dataSrc && !dataSrc.startsWith('data:') && src !== dataSrc) {
      if (src.startsWith('/assets/')) {
        dataSrc = src;
      } else if (dataSrc.startsWith('/assets/')) {
        src = dataSrc;
      } else {
        src = dataSrc;
      }
    }

    if ((!srcset || srcset.startsWith('data:')) && dataSrcset && !dataSrcset.startsWith('data:')) {
      srcset = dataSrcset;
    }

    attrs['src'] = src;
    if (dataSrc) {
      attrs['data-src'] = dataSrc;
    }
    if (srcset) {
      attrs['srcset'] = srcset;
    }
    if (dataSrcset) {
      attrs['data-srcset'] = dataSrcset;
    }

    const rebuiltAttrs = [];
    for (const [name, value] of Object.entries(attrs)) {
      rebuiltAttrs.push(`${name}="${value}"`);
    }

    return `<img ${rebuiltAttrs.join(' ')}>`;
  });
  
  // Rewrite search form action to /search instead of root / or absolute giacong.vn domain
  cleaned = cleaned.replace(/class="searchform"\s+action="https?:\/\/giacong\.vn\/?"/gi, 'class="searchform" action="/search"');
  cleaned = cleaned.replace(/action="https?:\/\/giacong\.vn\/?"\s+class="searchform"/gi, 'action="/search" class="searchform"');
  cleaned = cleaned.replace(/class="searchform"\s+action="\/?"/gi, 'class="searchform" action="/search"');
  cleaned = cleaned.replace(/action="\/?"\s+class="searchform"/gi, 'action="/search" class="searchform"');

  // Convert font theme paths to local public asset fonts to fix CORS blocker issues
  cleaned = cleaned.replace(/\/wp-content\/themes\/thiet-ke-web\/font\//gi, '/assets/fonts/');

  // Convert relative /wp-content/ and /wp-includes/ paths to point to the live site
  cleaned = cleaned.replace(/(?<=^|["'\s\(])\/wp-(content|includes)/g, 'https://giacong.vn/wp-$1');

  // Strip Facebook SDK fb-root div and its scripts to prevent hydration mismatch
  cleaned = cleaned.replace(/<div\s+id="fb-root"[\s\S]*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?connect\.facebook\.net[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?googletagmanager\.com[\s\S]*?<\/script>/gi, '');

  return cleaned;
}

let layoutShell: { beforeHeader: string; afterFooter: string; bodyClass: string } | null = null;

async function getLayoutShell(): Promise<{ beforeHeader: string; afterFooter: string; bodyClass: string }> {
  if (layoutShell) return layoutShell;

  try {
    let homePath = path.join(process.cwd(), 'src/data/pages', 'home.ejs');
    if (!fs.existsSync(homePath)) {
      homePath = path.join(process.cwd(), 'frontend/src/data/pages', 'home.ejs');
    }
    const html = await fs.promises.readFile(homePath, 'utf8');
    const cleanedHtml = cleanLinks(html);

    // Find body class
    let bodyClass = '';
    const bodyMatch = cleanedHtml.match(/<body\s+class=["']([^"']+)["']/i);
    if (bodyMatch) {
      bodyClass = bodyMatch[1];
    }

    // Remove <%- include head %>
    let parsedHtml = cleanedHtml.replace(/<%- include\(['"]\.\.\/partials\/head['"]\)\s*%>/g, '');
    parsedHtml = parsedHtml.replace(/<body[^>]*>/i, '');
    parsedHtml = parsedHtml.replace(/<\/body>\s*<\/html>/i, '');

    const headerMatch = parsedHtml.match(/<%- include\(['"]\.\.\/partials\/header['"]\)\s*%>/);
    const footerMatch = parsedHtml.match(/<%- include\(['"]\.\.\/partials\/footer['"]\)\s*%>/);

    if (headerMatch && footerMatch) {
      const headerIdx = headerMatch.index!;
      const footerIdx = footerMatch.index!;
      layoutShell = {
        beforeHeader: parsedHtml.substring(0, headerIdx),
        afterFooter: parsedHtml.substring(footerIdx + footerMatch[0].length).replace(/<div\s+id="main-menu"[\s\S]*$/i, ''),
        bodyClass: bodyClass
      };
    } else {
      layoutShell = {
        beforeHeader: '',
        afterFooter: '',
        bodyClass: 'home page-template-default'
      };
    }
  } catch (err) {
    console.error('Failed to parse layout shell from home.ejs:', err);
    layoutShell = {
      beforeHeader: '',
      afterFooter: '',
      bodyClass: 'home page-template-default'
    };
  }
  return layoutShell;
}

async function getPageDataRaw(slug: string): Promise<ParsedPage | null> {
  if (pageCache.has(slug)) {
    return pageCache.get(slug)!;
  }

  // Decode slug first
  let decodedSlug = decodeURIComponent(slug);
  if (decodedSlug.startsWith('tin-tuc/')) {
    decodedSlug = decodedSlug.substring(8);
  }
  const encodedSlug = encodeURIComponent(decodedSlug);
  
  // Try querying Laravel API first
  const laravelApiUrl = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8002';
  const apiEndpoint = `${laravelApiUrl}/api/pages/${encodedSlug}`;
  
  try {
    const res = await fetch(apiEndpoint, { cache: 'no-store' });
    if (res.ok) {
      const apiPage = await res.json();
      if (apiPage && apiPage.is_active) {
        let content = cleanLinks(apiPage.content || '');
        let beforeHeader = '';
        let afterFooter = '';

        const headerMatch = content.match(/<%- include\(['"]\.\.\/partials\/header['"]\)\s*%>/);
        const footerMatch = content.match(/<%- include\(['"]\.\.\/partials\/footer['"]\)\s*%>/);

        const shell = await getLayoutShell();

        if (headerMatch && footerMatch) {
          const headerIdx = headerMatch.index!;
          const footerIdx = footerMatch.index!;
          beforeHeader = content.substring(0, headerIdx);
          afterFooter = content.substring(footerIdx + footerMatch[0].length).replace(/<div\s+id="main-menu"[\s\S]*$/i, '');
          content = content.substring(headerIdx + headerMatch[0].length, footerIdx);
        } else {
          beforeHeader = shell.beforeHeader;
          afterFooter = shell.afterFooter;
        }

        const result: ParsedPage = {
          beforeHeader,
          content,
          afterFooter,
          bodyClass: apiPage.body_class || shell.bodyClass || '',
          title: apiPage.title || '',
          description: apiPage.description || '',
        };
        pageCache.set(slug, result);
        return result;
      }
    }
  } catch (err) {
    console.error(`Laravel API fetch failed for page ${slug}, falling back to local files:`, err);
  }

  // Fallback to local EJS file
  const possibleNames = [slug, decodedSlug, encodedSlug];
  let filePath = '';
  let foundName = '';
  let html = '';
  
  for (const name of possibleNames) {
    let p = path.join(process.cwd(), 'src/data/pages', `${name}.ejs`);
    if (!fs.existsSync(p)) {
      p = path.join(process.cwd(), 'frontend/src/data/pages', `${name}.ejs`);
    }
    try {
      html = await fs.promises.readFile(p, 'utf8');
      filePath = p;
      foundName = name;
      break;
    } catch (err) {
      // Ignore and try next name
    }
  }
  
  if (!filePath) {
    return null;
  }
  
  html = cleanLinks(html);
  
  // Find body class
  let bodyClass = '';
  const bodyMatch = html.match(/<body\s+class=["']([^"']+)["']/i);
  if (bodyMatch) {
    bodyClass = bodyMatch[1];
  }
  
  // Remove <%- include('../partials/head') %>
  html = html.replace(/<%- include\(['"]\.\.\/partials\/head['"]\)\s*%>/g, '');
  // Remove <body> opening tag and </body></html> closing tags
  html = html.replace(/<body[^>]*>/i, '');
  html = html.replace(/<\/body>\s*<\/html>/i, '');
  
  let beforeHeader = '';
  let content = html;
  let afterFooter = '';

  const headerMatch = html.match(/<%- include\(['"]\.\.\/partials\/header['"]\)\s*%>/);
  const footerMatch = html.match(/<%- include\(['"]\.\.\/partials\/footer['"]\)\s*%>/);

  if (headerMatch && footerMatch) {
    const headerIdx = headerMatch.index!;
    const footerIdx = footerMatch.index!;
    beforeHeader = html.substring(0, headerIdx);
    content = html.substring(headerIdx + headerMatch[0].length, footerIdx);
    afterFooter = html.substring(footerIdx + footerMatch[0].length).replace(/<div\s+id="main-menu"[\s\S]*$/i, '');
  } else {
    // Fallback if structure differs
    content = html;
  }
  
  // Retrieve title and description from metadata.json
  let title = '';
  let description = '';
  try {
    if (!cachedMetadata) {
      let metadataPath = path.join(process.cwd(), 'src/data/metadata.json');
      if (!fs.existsSync(metadataPath)) {
        metadataPath = path.join(process.cwd(), 'frontend/src/data/metadata.json');
      }
      try {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        cachedMetadata = JSON.parse(metadataContent);
      } catch (err) {
        // Ignore if metadata.json doesn't exist
      }
    }
    if (cachedMetadata) {
      const pageMeta = cachedMetadata.pages.find((p: any) => {
        return p.slug === foundName || 
               p.slug === slug || 
               p.slug === decodedSlug ||
               decodeURIComponent(p.slug) === decodedSlug;
      });
      if (pageMeta) {
        title = pageMeta.title || '';
        description = pageMeta.description || '';
      }
    }
  } catch (err) {
    console.error('Error reading metadata.json:', err);
  }
  
  const result: ParsedPage = {
    beforeHeader,
    content,
    afterFooter,
    bodyClass,
    title,
    description
  };
  
  // Do not cache local fallback to allow refetching once backend is ready
  // pageCache.set(slug, result);
  return result;
}

export const getPageData = cache(getPageDataRaw);
