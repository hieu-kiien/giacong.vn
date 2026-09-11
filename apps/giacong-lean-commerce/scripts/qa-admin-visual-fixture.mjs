// Local-only component fixture. Uses real rendered homepage markup and editor code;
// API state is disposable memory. Never proxies admin requests or loads credentials.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve(".runtime/admin-visual");
await mkdir(output, { recursive: true });
await build({
  stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {AdminVisualMode} from "./src/components/admin/AdminVisualMode"; createRoot(document.getElementById("visual-fixture")).render(<AdminVisualMode>{null}</AdminVisualMode>);', resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, outfile: `${output}/editor.js`, jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-link", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
    builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "fixture" }));
    builder.onLoad({ filter: /^navigation$/, namespace: "fixture" }, () => ({ contents: 'export function usePathname() { return location.pathname; }', loader: "js" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import React from "react"; export default function Link(props) { return React.createElement("a",props); }', loader: "js", resolveDir: process.cwd() }));
  } }],
});
const response = await fetch("http://localhost:3100/");
if (!response.ok) throw new Error("Start Next on port 3100 first");
const source = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
const markup = source.replace(/(src|srcset|href)="\/(?!\/)([^\"]*)"/g, (match,attr,path) => attr === "href" && !path.startsWith("_next/") && !path.startsWith("styles/") ? match : `${attr}="http://localhost:3100/${path}"`)
  .replace("</head>", '<link rel="stylesheet" href="http://127.0.0.1:3101/editor.css"></head>')
  .replace(/<body[^>]*>/, '$&<div id="visual-fixture"></div><div style="padding:8px;background:#fff3c4;color:#493800;text-align:center">BẢN THỬ CỤC BỘ · Dữ liệu thử, không ghi lên website thật</div>')
  .replace("</body>", '<script src="http://127.0.0.1:3101/editor.js"></script></body>');
const definitions = [
  ["brand_tagline", "Khẩu hiệu thương hiệu", "text", "Giải pháp gia công toàn diện"],
  ["hero_eyebrow", "Dòng giới thiệu nhỏ", "text", "Đối tác sản xuất của bạn"],
  ["hero_title", "Tiêu đề chính", "text", "Giải pháp gia công toàn diện"],
  ["hero_description", "Mô tả hero", "multiline", "Từ ý tưởng đến sản phẩm hoàn thiện."],
  ["hero_primary_cta_label", "Nhãn nút chính", "text", "Tìm hiểu dịch vụ"],
  ["hero_primary_cta_url", "Link nút chính", "url", "/dich-vu"],
  ["hero_secondary_cta_label", "Nhãn nút phụ", "text", "Liên hệ tư vấn"],
  ["hero_secondary_cta_url", "Link nút phụ", "url", "/lien-he"],
  ["hero_image_url", "Ảnh bìa", "image", ""],
  ["logo_url", "Logo", "image", ""],
  ["about_title", "Tiêu đề phần giới thiệu", "text", "Đồng hành cùng doanh nghiệp"],
  ["about_description", "Mô tả phần giới thiệu", "multiline", "Tư vấn và sản xuất theo nhu cầu."],
  ["contact_email", "Email", "text", "published@example.test"],
];
let settings;
const reset = () => { settings = definitions.map(([key,label,type,value]) => ({ key,label,type,description:label,group:key.startsWith("brand") || key === "logo_url" ? "brand" : "home",draftValue:key === "contact_email" ? "unrelated-draft@example.test" : value,publishedValue:value,effectiveValue:value,version:1,dirty:key === "contact_email",isDefaultValue:false })); };
reset();
const server = createServer(async (req,res) => {
  const url = new URL(req.url, "http://127.0.0.1:3101");
  const json = (data,status=200) => { res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data)); };
  if (url.pathname === "/reset" && req.method === "POST") { reset(); return json({ok:true}); }
  if (url.pathname.startsWith("/api/admin/")) {
    if (url.pathname === "/api/admin/session" && req.method === "GET") return json({ok:true,data:{authenticated:true,subject:"qa@example.test",role:"owner"}});
    if (req.method === "GET") return json({ok:true,data:url.pathname === "/api/admin/media" ? {media:[]} : {settings,canEdit:true,role:"owner"}});
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const item = settings.find(s => s.key === body.key);
    if (!item || item.version !== body.expectedVersion) return json({ok:false,code:"STALE_WRITE",message:"Nội dung đã thay đổi. Tải lại để đối chiếu."},409);
    if (url.pathname.endsWith("/publish")) {item.publishedValue=item.draftValue;item.dirty=false;}
    else {item.draftValue=body.value;item.dirty=item.draftValue!==item.publishedValue;}
    item.version++;
    return json({ok:true,data:{setting:item}});
  }
  if (["/editor.js","/editor.css"].includes(url.pathname)) { res.setHeader("content-type",url.pathname.endsWith("css")?"text/css":"text/javascript");return res.end(await readFile(`${output}${url.pathname}`)); }
  if (/\.(?:png|jpg|jpeg|webp|svg|woff2?|css)(?:$)/i.test(url.pathname)) {
    const asset = await fetch(`http://localhost:3100${url.pathname}`);
    res.writeHead(asset.status, {"content-type":asset.headers.get("content-type") ?? "application/octet-stream"});
    return res.end(Buffer.from(await asset.arrayBuffer()));
  }
  res.setHeader("content-type","text/html; charset=utf-8");res.end(markup);
});
server.listen(3101,"127.0.0.1",()=>console.log("Visual editor fixture: http://127.0.0.1:3101 (memory only)"));
