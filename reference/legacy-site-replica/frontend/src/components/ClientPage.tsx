'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const BLOCKED_SCRIPT_KEYWORDS = [
  'jquery.min.js', 'jquery.js', 'jquery_min',
  'underscore.min.js', 'underscore.js', 'underscore_min',
  'wp-util.min.js', 'wp-util.js', 'wp-util_min',
  'jquery.blockui.min.js', 'jquery.blockui.js', 'jquery_blockui',
  'add-to-cart.min.js', 'add-to-cart.js', 'add-to-cart_min',
  'js.cookie.min.js', 'js.cookie.js', 'js_cookie_min',
  'woocommerce.min.js', 'woocommerce_min',
  'onesignalsdk',
  'hooks.min.js', 'hooks.js', 'hooks_min',
  'i18n.min.js', 'i18n.js', 'i18n_min',
  'woocommerce-google-analytics-integration',
  'kk-star-ratings',
  'jquery.validate', 'jquery_validate',
  'add-to-cart-variation',
  'devvn-quick-buy', 'devvn-quickbuy',
  'link-whisper', 'wpil-frontend',
  'flatsome-instant-page',
  'sourcebuster',
  'order-attribution',
  'wp-polyfill',
  'hoverintent',
  '/flatsome/assets/js/flatsome', 'flatsome_7896dbf8',
  'flatsome-lazy-load', 'flatsome-lazy',
  '/flatsome/assets/js/woocommerce',
  'contact-form-7',
  'wpr-beacon', 'wp-rocket',
  'gtag', 'googletagmanager', 'google-analytics',
  'facebook.net', 'connect.facebook',
  'comment-reply', 'dmcabadgehelper'
];

function isBlockedScript(src: string): boolean {
  const lowercaseSrc = src.toLowerCase();
  return BLOCKED_SCRIPT_KEYWORDS.some(keyword => lowercaseSrc.includes(keyword));
}

interface ClientPageProps {
  bodyClass: string;
}

export default function ClientPage({ bodyClass }: ClientPageProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // 1. Set the body class name dynamically
    if (bodyClass) {
      document.body.className = bodyClass;
    }

    // Initialize and protect global fallback for wpcf7 to prevent errors and schema erasing
    if (typeof window !== 'undefined') {
      const existingWpcf7 = (window as any).wpcf7 || {};
      let wpcf7Val = {
        api: existingWpcf7.api || { root: '', namespace: '' },
        schemas: existingWpcf7.schemas || new Map()
      };

      try {
        const desc = Object.getOwnPropertyDescriptor(window, 'wpcf7');
        if (!desc || desc.configurable) {
          if (!desc || !desc.get) {
            Object.defineProperty(window, 'wpcf7', {
              get() {
                return wpcf7Val;
              },
              set(newVal) {
                if (newVal) {
                  const existingSchemas = wpcf7Val.schemas || new Map();
                  const newSchemas = newVal.schemas || new Map();
                  const mergedSchemas = new Map([...existingSchemas, ...newSchemas]);
                  wpcf7Val = {
                    ...newVal,
                    schemas: mergedSchemas
                  };
                }
              },
              configurable: true,
              enumerable: true
            });
          }
        }
      } catch (err) {
        console.warn('Failed to define window.wpcf7 property descriptor:', err);
        (window as any).wpcf7 = (window as any).wpcf7 || {};
        (window as any).wpcf7.schemas = (window as any).wpcf7.schemas || new Map();
      }
    }

    // 2. Intercept and execute scripts in the parsed EJS content
    const container = document.getElementById('original-content');
    
    const reattachFlatsome = () => {
      if (typeof window !== 'undefined') {
        let attempts = 0;
        const maxAttempts = 20;
        const interval = 100;
        
        const tryAttach = () => {
          if ((window as any).jQuery && (window as any).Flatsome) {
            try {
              const $ = (window as any).jQuery;
              
              // Clean up pre-rendered toggle buttons to prevent double-rendered toggle buttons
              // $('.sidebar-menu .toggle').remove();
              
              // Clean up event listeners first to prevent duplicates
              $('.header-nav > li > a, .top-bar-nav > li > a').off('focus');
              $('.nav li.has-dropdown').off('touchstart click mouseenter mouseleave');
              
              // Call Flatsome attach
              (window as any).Flatsome.attach(document);
              $('a[aria-label="Menu"], .nav-icon a').off('click');
              $(document).off('click', 'a[aria-label="Menu"], .nav-icon a');
              $('.sidebar-menu a, .sidebar-menu .toggle').off('click');
              $(document).off('click', '#main-menu a');
              $(document).off('click', '.mobile-sidebar a');
              $(document).off('click', '.sidebar-menu a');
              $(document).off('click', '.sidebar-menu .toggle');
              $('.sidebar-menu .toggle:not([aria-expanded])').remove();
              console.log('Flatsome behaviors successfully re-attached.');

              // Run a deferred cleanup to disable any late-bound click events from client-side script execution
              setTimeout(() => {
                try {
                  const _$ = (window as any).jQuery;
                  if (_$) {
                    _$('a[aria-label="Menu"], .nav-icon a').off('click');
                    _$(document).off('click', 'a[aria-label="Menu"], .nav-icon a');
                    _$('.sidebar-menu a, .sidebar-menu .toggle').off('click');
                    _$(document).off('click', '#main-menu a');
                    _$(document).off('click', '.mobile-sidebar a');
                    _$(document).off('click', '.sidebar-menu a');
                    _$(document).off('click', '.sidebar-menu .toggle');
                    console.log('Deferred click handlers cleanup completed.');
                  }
                } catch (err) {}
              }, 1000);
            } catch (err) {
              console.error('Error re-attaching Flatsome:', err);
            }
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryAttach, interval);
          } else {
            console.warn('Flatsome or jQuery not found after 20 attempts.');
          }
        };
        
        tryAttach();
      }
    };

    if (container) {
      const scripts = Array.from(container.querySelectorAll('script'));
      
      // Filter out scripts that are already executed
      const scriptsToExecute = scripts.filter(s => s.getAttribute('data-executed') !== 'true');

      // Synchronously mark all scripts as executed to prevent concurrent/duplicate execution across effects
      scriptsToExecute.forEach(s => s.setAttribute('data-executed', 'true'));

      const executeScripts = async () => {
        for (const oldScript of scriptsToExecute) {
          // Skip Next.js scripts just in case
          if (oldScript.src && (oldScript.src.includes('_next') || oldScript.src.includes('webpack'))) {
            continue;
          }

          // If the script has a src, check if it's already statically loaded in the layout (outside `#original-content`)
          // In addition, skip all scripts pointing to local static assets/js since they are loaded globally
          if (oldScript.src) {
            const srcPath = oldScript.getAttribute('src') || '';
            
            // Comprehensive blocklist for already globally-loaded core/plugin/tracking scripts
            if (isBlockedScript(srcPath) || isBlockedScript(oldScript.src)) {
              console.log(`Skipping duplicate/blocked core/plugin script: ${srcPath}`);
              continue;
            }

            if (srcPath.includes('assets/js/') || oldScript.src.includes('assets/js/')) {
              console.log(`Skipping static script: ${srcPath}`);
              continue;
            }
            
            const alreadyExists = Array.from(document.querySelectorAll('script')).some((s) => {
              if (s.closest('#original-content')) {
                return false; // Skip the ones inside our original-content container
              }
              const sPath = s.getAttribute('src');
              return sPath && (sPath === srcPath || s.src === oldScript.src);
            });

            if (alreadyExists) {
              console.log(`Skipping duplicate script execution: ${srcPath}`);
              continue;
            }
          }

          const newScript = document.createElement('script');

          // Copy all attributes
          Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });

          // Dynamically inserted external scripts are async by default. Preserve source order.
          if (oldScript.src) {
            newScript.async = false;
          }

          // Mark as executed
          newScript.setAttribute('data-executed', 'true');

          // Copy inner inline script content
          if (oldScript.innerHTML) {
            newScript.innerHTML = oldScript.innerHTML;
          }

          // For external scripts, wait for them to load before executing subsequent scripts to preserve DOM order
          if (newScript.src) {
            const loaded = new Promise<void>((resolve) => {
              newScript.onload = () => resolve();
              newScript.onerror = () => {
                console.error(`Failed to load script: ${newScript.src}`);
                resolve();
              };
            });

            // Replace only after handlers are attached; cached assets can load immediately.
            oldScript.parentNode?.replaceChild(newScript, oldScript);
            await loaded;
          } else {
            // Replace the old script tag with the new one to trigger execution.
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          }
        }
      };

      if (scriptsToExecute.length > 0) {
        executeScripts().then(() => {
          reattachFlatsome();
        });
      } else {
        reattachFlatsome();
      }
    } else {
      reattachFlatsome();
    }

    // 3. Setup form interception
    const handleFormSubmit = async (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;

      // Check if it's a search form
      const isSearchForm = form.classList.contains('searchform') || form.getAttribute('role') === 'search' || !!form.querySelector('input[name="s"]');
      
      // Check if it's a contact or quote form used by captured templates
      const isContactForm = form.classList.contains('wpcf7-form') || form.classList.contains('devvn_cusstom_info') || form.id === 'devvn_cusstom_info';

      if (isSearchForm) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const searchInput = form.querySelector('input[name="s"]') as HTMLInputElement;
        const query = searchInput ? searchInput.value : '';
        window.location.href = `/search?s=${encodeURIComponent(query)}`;
        return;
      }

      if (!isContactForm) {
        // Only intercept search forms and contact forms used by captured templates
        return;
      }

      // Stop propagation and prevent default immediately to prevent conflict with legacy WordPress AJAX scripts and block double submissions
      e.preventDefault();
      e.stopImmediatePropagation();

      // Check required inputs to validate
      const text508 = form.querySelector('[name="text-508"]') as HTMLInputElement | null;
      const tel991 = form.querySelector('[name="tel-991"]') as HTMLInputElement | null;
      const textarea859 = form.querySelector('[name="textarea-859"]') as HTMLTextAreaElement | null;
      
      const text34 = form.querySelector('[name="text-34"]') as HTMLInputElement | null;
      const tel471 = form.querySelector('[name="tel-471"]') as HTMLInputElement | null;

      // Form 1 validations
      if (text508 || tel991 || textarea859) {
        if (text508 && !text508.value.trim()) {
          alert('Vui lòng nhập họ và tên của bạn.');
          return;
        }
        if (tel991 && !tel991.value.trim()) {
          alert('Vui lòng nhập số điện thoại liên hệ.');
          return;
        }
        if (textarea859 && !textarea859.value.trim()) {
          alert('Vui lòng nhập nội dung yêu cầu.');
          return;
        }
      }

      // Form 2 validations
      if (text34 || tel471) {
        if (text34 && !text34.value.trim()) {
          alert('Vui lòng nhập họ và tên của bạn.');
          return;
        }
        if (tel471 && !tel471.value.trim()) {
          alert('Vui lòng nhập số điện thoại liên hệ.');
          return;
        }
      }

      // Block double submissions
      if (form.getAttribute('data-submitting') === 'true') {
        return;
      }
      form.setAttribute('data-submitting', 'true');

      const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLButtonElement | HTMLInputElement | null;
      let originalText = '';
      if (submitButton) {
        submitButton.disabled = true;
        originalText = submitButton.tagName === 'INPUT'
          ? (submitButton as HTMLInputElement).value
          : submitButton.textContent || '';
        if (submitButton.tagName === 'INPUT') {
          (submitButton as HTMLInputElement).value = 'Đang gửi...';
        } else {
          submitButton.textContent = 'Đang gửi...';
          submitButton.setAttribute('value', 'Đang gửi...');
        }
      }

      const formData = new FormData(form);
      const data: Record<string, any> = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      // Explicitly append client-side route
      data['path'] = window.location.pathname;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8002';
        const response = await fetch(`${backendUrl}/api/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success) {
          alert(result.message || 'Cảm ơn bạn! Yêu cầu của bạn đã được gửi thành công.');
          form.reset();
        } else {
          alert(result.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại sau.');
        }
      } catch (err) {
        console.error('Error submitting contact form:', err);
        alert('Gửi yêu cầu thất bại. Vui lòng thử lại sau.');
      } finally {
        form.removeAttribute('data-submitting');
        if (submitButton) {
          submitButton.disabled = false;
          if (submitButton.tagName === 'INPUT') {
            (submitButton as HTMLInputElement).value = originalText;
          } else {
            submitButton.textContent = originalText;
            submitButton.removeAttribute('value');
          }
        }
      }
    };

    // Listen to the submit event in the capture phase
    document.addEventListener('submit', handleFormSubmit, true);

    // 4. Intercept click events on relative links for SPA navigation
    const handleLinkClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) {
        return;
      }

      if (anchor.getAttribute('target') === '_blank') {
        return;
      }

      let href = anchor.getAttribute('href');
      if (!href) {
        return;
      }

      // Normalize absolute giacong.vn links to relative paths
      if (href.startsWith('https://giacong.vn')) {
        href = href.replace('https://giacong.vn', '');
      } else if (href.startsWith('http://giacong.vn')) {
        href = href.replace('http://giacong.vn', '');
      } else if (href.startsWith('//giacong.vn')) {
        href = href.replace('//giacong.vn', '');
      } else if (href.startsWith('http://localhost:3000')) {
        href = href.replace('http://localhost:3000', '');
      } else if (href.startsWith('http://127.0.0.1:3000')) {
        href = href.replace('http://127.0.0.1:3000', '');
      }

      // Check relative link starting with / and not // or #
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('#')) {
        return;
      }

      // Ignore mailto: and tel:
      if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      // Ignore media/file assets
      const isMediaOrFile = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|webm|mp3|wav|zip|tar|gz|dmg|exe)$/i.test(href);
      if (isMediaOrFile) {
        return;
      }

      e.preventDefault();
      router.push(href);
    };

    document.addEventListener('click', handleLinkClick);

    return () => {
      document.removeEventListener('click', handleLinkClick);
      document.removeEventListener('submit', handleFormSubmit, true);

      // Clean up mobile scroll lock classes on unmount
      if (typeof window !== 'undefined') {
        const html = document.documentElement;
        const body = document.body;
        const classesToRemove = ['has-off-canvas', 'has-off-canvas-left', 'has-off-canvas-right', 'off-canvas-active'];
        classesToRemove.forEach(cls => {
          html.classList.remove(cls);
          body.classList.remove(cls);
        });

        // Close magnificPopup
        if ((window as any).jQuery && (window as any).jQuery.magnificPopup) {
          try {
            (window as any).jQuery.magnificPopup.close();
          } catch (e) {
            console.error('Error closing magnificPopup:', e);
          }
        }
      }
    };
  }, [bodyClass, pathname, router]);

  return null;
}

export function SafeHTML({ html, ...props }: { html: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}
