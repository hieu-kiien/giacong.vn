const storefrontStyles = [
  "/styles/menu-icons.css",
  "/styles/woocommerce-blocks.css",
  "/styles/star-ratings.css",
  "/styles/quick-buy.css",
  "/styles/flatsome.css",
  "/styles/flatsome-shop.css",
  "/styles/giacong.css",
  "/styles/fixed-toc.css",
  "/styles/contact-form.css",
];

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <>{storefrontStyles.map((href) => <link key={href} rel="stylesheet" href={href} />)}{children}</>;
}
