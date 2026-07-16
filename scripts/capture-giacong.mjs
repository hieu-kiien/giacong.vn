import { mkdir, writeFile } from "node:fs/promises";

const styles = [
  ["flatsome.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome.css?ver=3.16.2"],
  ["flatsome-shop.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome-shop.css?ver=3.16.2"],
  ["giacong.css", "https://giacong.vn/wp-content/themes/thiet-ke-web/style.css?ver=3.0"],
];

const response = await fetch("https://giacong.vn/");
if (!response.ok) {
  throw new Error(`Unable to capture giacong.vn: ${response.status}`);
}

const source = await response.text();
const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
if (!body) {
  throw new Error("Unable to locate the rendered body.");
}

await mkdir("src/data", { recursive: true });
await mkdir("public/styles", { recursive: true });
const inlineStyles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .map((match) => match[1])
  .join("\n");

const hydratedMarkup = body
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/src="data:image[^\"]*"\s+data-src="([^\"]+)"/gi, 'src="$1"')
  .replace(/\sdata-srcset=/gi, " srcset=")
  .replace(/\sdata-src=/gi, " src=")
  .replace(/data-animate="([^\"]+)"/gi, 'data-animate="$1" data-animated="true"')
  .replace(/class="([^\"]*\bsection-bg\b[^\"]*)"/gi, (_, classes) => (
    `class="${classes.includes("bg-loaded") ? classes : `${classes} bg-loaded`}"`
  ));

await writeFile("src/data/giacong.html", hydratedMarkup, "utf8");
await writeFile("public/styles/giacong-sections.css", inlineStyles, "utf8");

await Promise.all(styles.map(async ([name, url]) => {
  const stylesheet = await fetch(url);
  if (!stylesheet.ok) throw new Error(`Unable to download ${name}: ${stylesheet.status}`);
  await writeFile(`public/styles/${name}`, await stylesheet.text(), "utf8");
}));
