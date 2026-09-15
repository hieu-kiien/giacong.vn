-- Keep the customer-facing catalog entry consistent with the direct purchase route.
UPDATE site_navigation_items
SET draft_label = 'Mua hàng',
    published_label = 'Mua hàng'
WHERE captured_menu_id = 'menu-item-1742'
  AND menu_key = 'primary';
