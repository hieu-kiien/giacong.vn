import { mkdir, writeFile } from "node:fs/promises";

const styles = [
  ["flatsome.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome.css?ver=3.16.2"],
  ["flatsome-shop.css", "https://giacong.vn/wp-content/themes/flatsome/assets/css/flatsome-shop.css?ver=3.16.2"],
  ["giacong.css", "https://giacong.vn/wp-content/themes/thiet-ke-web/style.css?ver=3.0"],
];
const iconFiles = ["fl-icons.eot", "fl-icons.woff2", "fl-icons.ttf", "fl-icons.woff", "fl-icons.svg"];
const remoteIconRoot = "https://giacong.vn/wp-content/themes/flatsome/assets/css/icons/";
const fontFiles = ["SFProDisplay-Regular.woff2", "SFProDisplay-Regular.woff", "SFProDisplay-Regular.ttf", "SFProDisplay-Bold.woff2", "SFProDisplay-Bold.woff", "SFProDisplay-Bold.ttf"];
const remoteFontRoot = "https://giacong.vn/wp-content/themes/thiet-ke-web/font/";

const response = await fetch("https://giacong.vn/");
if (!response.ok) {
  throw new Error(`Unable to capture giacong.vn: ${response.status}`);
}

const source = await response.text();

await mkdir("src/data", { recursive: true });
await mkdir("src/data/pages", { recursive: true });
await mkdir("public/styles", { recursive: true });
await mkdir("public/styles/icons", { recursive: true });
await mkdir("public/styles/fonts", { recursive: true });

function transformPage(pageSource) {
  const body = pageSource.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) throw new Error("Unable to locate the rendered body.");
  const pageStyles = [...pageSource.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n")
    .replaceAll(remoteIconRoot, "/styles/icons/")
    .replaceAll(remoteFontRoot, "/styles/fonts/")
    .replaceAll("/wp-content/themes/thiet-ke-web/font/", "/styles/fonts/")
    .replaceAll("url(/wp-content/uploads/", "url(https://giacong.vn/wp-content/uploads/")
    .replaceAll("url('/wp-content/uploads/", "url('https://giacong.vn/wp-content/uploads/")
    .replaceAll('url("/wp-content/uploads/', 'url("https://giacong.vn/wp-content/uploads/');
  const title = pageSource.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Giacong.vn";
  const markup = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/src="data:image[^\"]*"\s+data-src="([^\"]+)"/gi, 'src="$1"')
    .replace(/\sdata-srcset=/gi, " srcset=")
    .replace(/\sdata-src=/gi, " src=")
    .replace(/data-animate="([^\"]+)"/gi, 'data-animate="$1" data-animated="true"')
    .replace(/class="([^\"]*\bsection-bg\b[^\"]*)"/gi, (_, classes) => (
      `class="${classes.includes("bg-loaded") ? classes : `${classes} bg-loaded`}"`
    ))
    .replace(/href="https:\/\/giacong\.vn([^\"]*)"/gi, 'href="$1"')
    .replace(/action="https:\/\/giacong\.vn([^\"]*)"/gi, 'action="$1"')
    .replaceAll('"/wp-content/', '"https://giacong.vn/wp-content/')
    .replaceAll(", /wp-content/", ", https://giacong.vn/wp-content/");
  return { markup, pageStyles, title };
}

const header = source.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? "";
const paths = new Set(["/"]);
for (const match of header.matchAll(/href="(https:\/\/giacong\.vn\/[^\"#?]*)/gi)) {
  const path = new URL(match[1]).pathname;
  if (path !== "/" && !path.includes("%20")) paths.add(path);
}

const manifest = {};
const queue = [...paths];
async function worker() {
  while (queue.length) {
    const path = queue.shift();
    const pageResponse = path === "/" ? response : await fetch(new URL(path, "https://giacong.vn"));
    if (!pageResponse.ok) continue;
    const pageSource = path === "/" ? source : await pageResponse.text();
    const data = transformPage(pageSource);
    const file = path === "/" ? "home.json" : `${path.replace(/^\/+|\/+$/g, "").replaceAll("/", "__")}.json`;
    await writeFile(`src/data/pages/${file}`, JSON.stringify(data), "utf8");
    manifest[path] = file;
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
await writeFile("src/data/pages/manifest.json", JSON.stringify(manifest, null, 2), "utf8");

const home = JSON.parse(await (await import("node:fs/promises")).readFile("src/data/pages/home.json", "utf8"));
await writeFile("src/data/giacong.html", home.markup, "utf8");
await writeFile("public/styles/giacong-sections.css", home.pageStyles, "utf8");

await Promise.all(styles.map(async ([name, url]) => {
  const stylesheet = await fetch(url);
  if (!stylesheet.ok) throw new Error(`Unable to download ${name}: ${stylesheet.status}`);
  await writeFile(`public/styles/${name}`, (await stylesheet.text()).replaceAll(remoteIconRoot, "/styles/icons/").replaceAll(remoteFontRoot, "/styles/fonts/").replaceAll("/wp-content/themes/thiet-ke-web/font/", "/styles/fonts/"), "utf8");
}));

await Promise.all(iconFiles.map(async (name) => {
  const response = await fetch(`${remoteIconRoot}${name}?v=3.16.2`);
  if (response.ok) await writeFile(`public/styles/icons/${name}`, Buffer.from(await response.arrayBuffer()));
}));

await Promise.all(fontFiles.map(async (name) => {
  const response = await fetch(`${remoteFontRoot}${name}`);
  if (response.ok) await writeFile(`public/styles/fonts/${name}`, Buffer.from(await response.arrayBuffer()));
}));
