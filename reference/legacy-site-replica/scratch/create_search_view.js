const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'views', 'pages', 'san-pham.ejs');
const destPath = path.join(__dirname, '..', 'views', 'pages', 'search.ejs');

if (!fs.existsSync(sourcePath)) {
  console.error('san-pham.ejs not found!');
  process.exit(1);
}

let content = fs.readFileSync(sourcePath, 'utf8');

// Find the start of the products container
const startKeyword = '<div class="products row row-small';
const startIndex = content.indexOf(startKeyword);

if (startIndex === -1) {
  console.error('Could not find products row in san-pham.ejs');
  process.exit(1);
}

// Find the start of the page-description container
const pageDescIndex = content.indexOf('<div class="page-description">');
if (pageDescIndex === -1) {
  console.error('Could not find page-description in san-pham.ejs');
  process.exit(1);
}

// Find the last </div> before the page-description, which should be the end of the products row
const temp = content.substring(0, pageDescIndex);
const closingDivIndex = temp.lastIndexOf('</div>');

if (closingDivIndex === -1 || closingDivIndex < startIndex) {
  console.error('Could not find closing div for products container before page description');
  process.exit(1);
}

const endIndex = closingDivIndex + 6; // Include the closing tag '</div>'

const beforeProducts = content.substring(0, startIndex);
const afterProducts = content.substring(endIndex);

// Dynamic search results block to insert
const searchLoopHtml = `<div class="products row row-small large-columns-6 medium-columns-4 small-columns-2 has-equal-box-heights equalize-box">
  <% if (typeof results !== 'undefined' && results.length > 0) { %>
    <% results.forEach(function(item) { %>
      <div class="product-small col has-hover product type-product status-publish instock has-post-thumbnail shipping-taxable product-type-simple">
        <div class="col-inner">
          <div class="product-small box ">
            <div class="box-image">
              <div class="image-fade_in_back">
                <a href="<%= item.href %>" aria-label="<%= item.name %>">
                  <% if (item.image) { %>
                    <img width="247" height="296" src="<%= item.image %>" class="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" alt="<%= item.name %>" decoding="async">
                  <% } else { %>
                    <div style="width: 247px; height: 296px; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0; border-radius: 4px;">
                      <span style="font-size: 14px; color: #666; font-weight: bold; text-align: center; padding: 10px;"><%= item.type === 'service' ? 'Dịch vụ' : 'Sản phẩm' %></span>
                    </div>
                  <% } %>
                </a>
              </div>
            </div>
            <div class="box-text box-text-products text-center grid-style-2" style="height: 141.516px;">
              <div class="title-wrapper">
                <p class="name product-title woocommerce-loop-product__title" style="height: 50.9844px;">
                  <a href="<%= item.href %>" class="woocommerce-LoopProduct-link woocommerce-loop-product__link"><%= item.name %></a>
                </p>
              </div>
              <div class="price-wrapper" style="height: 0px;"></div>
              <% if (item.price) { %>
                <div class="price-wrapper" style="margin-top: 5px;"><span class="price"><%= item.price %></span></div>
              <% } %>
              <div class="add-to-cart-button" style="height: 52.5px;">
                <a href="<%= item.href %>" class="primary is-small mb-0 button product_type_simple is-outline">Xem chi tiết</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    <% }); %>
  <% } else { %>
    <div class="col large-12 text-center" style="padding: 50px 0; width: 100%;">
      <p style="font-size: 18px; color: #666;">Không tìm thấy sản phẩm hoặc dịch vụ nào phù hợp với từ khóa của bạn.</p>
    </div>
  <% } %>
</div>`;

let newContent = beforeProducts + searchLoopHtml + afterProducts;

// Replace title
newContent = newContent.replace(
  /<h1 class="shop-page-title is-xlarge">[^<]*<\/h1>/gi,
  '<h1 class="shop-page-title is-xlarge">Kết Quả Tìm Kiếm Cho: "<%= typeof query !== "undefined" ? query : "" %>"</h1>'
);

// Replace result count
newContent = newContent.replace(
  /<p class="woocommerce-result-count[^"]*"[^>]*>[^<]*<\/p>/gi,
  '<p class="woocommerce-result-count" aria-hidden="false">Tìm thấy <%= typeof results !== "undefined" ? results.length : 0 %> kết quả</p>'
);

// Also handle the simple p tag count check if any
newContent = newContent.replace(
  /Showing all \d+ results/gi,
  'Tìm thấy <%= typeof results !== "undefined" ? results.length : 0 %> kết quả'
);

// Replace breadcrumb
newContent = newContent.replace(
  /<nav class="woocommerce-breadcrumb[^>]*>[\s\S]*?<\/nav>/gi,
  '<nav class="woocommerce-breadcrumb breadcrumbs uppercase"><a href="/">Trang chủ</a> <span class="divider">/</span> Tìm kiếm</nav>'
);

fs.writeFileSync(destPath, newContent, 'utf8');
console.log('search.ejs created successfully!');
