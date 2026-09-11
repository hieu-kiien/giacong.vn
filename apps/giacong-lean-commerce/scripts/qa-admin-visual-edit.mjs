// Regeneratable browser regression evidence against the isolated memory fixture.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "playwright/test";
const origin = "http://127.0.0.1:3101";
const output = ".runtime/admin-visual";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true});
const results=[];
async function run(name,check,width=1440) {
  await fetch(`${origin}/reset`,{method:"POST"});
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});
  page.setDefaultTimeout(2500);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  try {await page.goto(origin,{waitUntil:"domcontentloaded",timeout:15000});await expect(page.getByRole("button",{name:"Bảng nội dung",exact:true})).toBeVisible();await check(page);assert.deepEqual(errors,[]);results.push({name,pass:true});}
  catch(e){results.push({name,pass:false,error:e.message});}
  finally{await page.close();}
}
const actions = page=>page.locator('[aria-label="Hành động chỉnh sửa trực tiếp"]');
async function edit(page,key,value) {await page.locator(`[data-admin-direct-target="${key}"]`).click();await page.getByRole("dialog").getByRole("textbox").first().fill(value);}
await run("Unrelated saved draft never enables publishing",async page=>{await expect(actions(page).getByRole("button",{name:"Xuất bản",exact:true})).toBeDisabled();});
await run("Reverting typed text clears local dirty state",async page=>{await edit(page,"hero_title","Thay đổi");await page.getByRole("dialog").getByRole("textbox").fill("Giải pháp gia công toàn diện");await expect(actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true})).toBeDisabled();});
await run("Save is visible, persists through reload and publishes only supported fields",async page=>{
  await edit(page,"hero_title","Nội dung đã sửa trực tiếp");await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu");await page.reload();
  await expect(page.locator('[data-admin-direct-target="hero_title"]')).toHaveText("Nội dung đã sửa trực tiếp");
  await actions(page).getByRole("button",{name:"Xuất bản",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Xuất bản thay đổi?"})).toBeVisible();await page.getByTestId("button-confirm-dialog").click();
  await expect(page.getByRole("status")).toContainText("Đã xuất bản");
  const response=await fetch(`${origin}/api/admin/site-settings`);const {data}=await response.json();
  assert.equal(data.settings.find(s=>s.key==="contact_email").publishedValue,"published@example.test");
});
await run("Partial save preserves successful versions and can retry remaining fields",async page=>{
  await edit(page,"hero_title","Tiêu đề mới");await edit(page,"hero_description","Mô tả mới");
  let fail=true;const saved=[];
  await page.route("**/api/admin/site-settings",async route=>{
    if(route.request().method()!=="PATCH")return route.continue();
    const body=route.request().postDataJSON();
    if(body.key==="hero_description"&&fail)return route.fulfill({status:503,json:{ok:false,code:"UNAVAILABLE",message:"Mất kết nối thử nghiệm"}});
    saved.push(body.key);await route.continue();
  });
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("alert")).toContainText("Mất kết nối");
  await expect(actions(page)).toContainText("1 thay đổi chưa lưu");fail=false;
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("status")).toContainText("Đã lưu");
  assert.deepEqual(saved,["hero_title","hero_description"]);
});
await run("Hero image is selectable directly",async page=>{await page.locator('[data-admin-direct-target="hero_image_url"]').click();await expect(page.getByRole("dialog")).toContainText("Chọn ảnh từ thư viện");});
await run("Image preview changes immediately and returns to the published image",async page=>{
  const target=page.locator('[data-admin-direct-target="hero_image_url"]');const original=await target.getAttribute("src");
  await edit(page,"hero_image_url","/images/home-hero/hero-2.png");await expect(target).toHaveAttribute("src","/images/home-hero/hero-2.png");
  await page.getByRole("button",{name:"Đóng chỉnh sửa trực tiếp"}).click();await page.getByRole("button",{name:"Xem bản đã đăng",exact:true}).click();
  await expect(page.locator('[data-gallery-image="1"]')).toHaveAttribute("src",original);
  await page.getByRole("button",{name:"Bật chỉnh sửa",exact:true}).click();await expect(target).toHaveAttribute("src","/images/home-hero/hero-2.png");
});
await run("Image library selection updates the preview",async page=>{
  await page.route("**/api/admin/media?all=1",route=>route.fulfill({json:{ok:true,data:{media:[{id:"qa-image",namespace:"site",originalFilename:"anh-thu.png",publicUrl:"/images/home-hero/hero-3.png"}]}}}));
  await page.locator('[data-admin-direct-target="hero_image_url"]').click();await page.getByRole("button",{name:"Chọn ảnh từ thư viện",exact:true}).click();
  await page.getByRole("button",{name:"Chọn anh-thu.png",exact:true}).click();await expect(page.locator('[data-gallery-image="1"]')).toHaveAttribute("src","/images/home-hero/hero-3.png");
});
await run("Upload sends image and version, saves a draft and preserves other unsaved text",async page=>{
  await edit(page,"hero_title","Tiêu đề chưa lưu");
  const {data}=await (await fetch(`${origin}/api/admin/site-settings`)).json();
  const setting=data.settings.find(s=>s.key==="hero_image_url");
  let uploaded=false;
  await page.route("**/api/admin/site-settings/media",async route=>{
    const request=route.request();const body=request.postDataBuffer().toString("latin1");
    assert.match(request.headers()["content-type"],/multipart\/form-data; boundary=/);
    assert.match(body,/name="key"\r\n\r\nhero_image_url/);
    assert.match(body,/name="expectedVersion"\r\n\r\n1/);
    assert.match(body,/filename="qa.png"/);uploaded=true;
    await route.fulfill({json:{ok:true,data:{setting:{...setting,draftValue:"/images/home-hero/hero-4.png",version:2,dirty:true}}}});
  });
  await page.locator('[data-admin-direct-target="hero_image_url"]').click();
  await page.getByLabel("Tải ảnh từ máy").setInputFiles({name:"qa.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfKsAAAAASUVORK5CYII=","base64")});
  await expect(page.getByRole("status")).toContainText("Đã tải ảnh và lưu bản nháp");assert.equal(uploaded,true);
  await expect(page.locator('[data-gallery-image="1"]')).toHaveAttribute("src","/images/home-hero/hero-4.png");
  await expect(actions(page)).toContainText("1 thay đổi chưa lưu");
  await expect(page.locator('[data-admin-direct-target="hero_title"]')).toHaveText("Tiêu đề chưa lưu");
});
await run("Invalid image makes no upload request and failed upload preserves draft",async page=>{
  let requests=0;
  await page.route("**/api/admin/site-settings/media",route=>{requests++;return route.fulfill({status:503,json:{ok:false,message:"Kho ảnh tạm thời không khả dụng"}});});
  await edit(page,"hero_image_url","/images/home-hero/hero-2.png");
  const input=page.getByLabel("Tải ảnh từ máy");
  await input.setInputFiles({name:"qa.txt",mimeType:"text/plain",buffer:Buffer.from("invalid")});
  await expect(page.getByRole("alert")).toContainText("Chọn ảnh JPEG");assert.equal(requests,0);
  await input.setInputFiles({name:"qa.png",mimeType:"image/png",buffer:Buffer.from("image")});
  await expect(page.getByRole("alert")).toContainText("Kho ảnh tạm thời");assert.equal(requests,1);
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("/images/home-hero/hero-2.png");
  await expect(actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true})).toBeEnabled();
});
await run("Lost save response retries the same idempotency key",async page=>{
  await edit(page,"hero_title","Lưu một lần");let firstBody;let savedResult;
  await page.route("**/api/admin/site-settings",async route=>{
    if(route.request().method()!=="PATCH")return route.continue();
    const body=route.request().postDataJSON();
    if(!firstBody){firstBody=body;const response=await route.fetch();savedResult=await response.json();return route.abort("connectionfailed");}
    assert.deepEqual(body,firstBody);return route.fulfill({json:savedResult});
  });
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("alert")).toBeVisible();
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("status")).toContainText("Đã lưu");
  const {data}=await (await fetch(`${origin}/api/admin/site-settings`)).json();assert.equal(data.settings.find(s=>s.key==="hero_title").version,2);
});
await run("Partial publish retries only the remaining setting",async page=>{
  await edit(page,"hero_title","Tiêu đề mới");await edit(page,"hero_description","Mô tả mới");
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("status")).toContainText("Đã lưu");
  const published=[];let fail=true;
  await page.route("**/api/admin/site-settings/publish",async route=>{
    const body=route.request().postDataJSON();
    if(body.key==="hero_description"&&fail)return route.fulfill({status:503,json:{ok:false,message:"Thử lại xuất bản"}});
    published.push(body.key);return route.continue();
  });
  await actions(page).getByRole("button",{name:"Xuất bản",exact:true}).click();await page.getByTestId("button-confirm-dialog").click();await expect(page.getByRole("alert")).toContainText("Thử lại xuất bản");fail=false;
  await actions(page).getByRole("button",{name:"Xuất bản",exact:true}).click();await page.getByTestId("button-confirm-dialog").click();await expect(page.getByRole("status")).toContainText("Đã xuất bản");
  assert.deepEqual(published,["hero_title","hero_description"]);
});
await run("Stale write preserves text and reload requires explicit discard",async page=>{
  await edit(page,"hero_title","Giữ bản đang sửa");
  await page.route("**/api/admin/site-settings",route=>route.request().method()==="PATCH"?route.fulfill({status:409,json:{ok:false,code:"STALE_WRITE",message:"Nội dung đã thay đổi ở phiên khác"}}):route.continue());
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();await expect(page.getByRole("alert")).toContainText("phiên khác");
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("Giữ bản đang sửa");
  await page.getByRole("button",{name:"Tải lại dữ liệu",exact:true}).click();await expect(page.getByRole("dialog",{name:"Bỏ thay đổi chưa lưu?"})).toBeVisible();
  await page.getByRole("button",{name:"Ở lại",exact:true}).click();await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("Giữ bản đang sửa");
});
await run("Inputs are locked during save and regain focus after Escape",async page=>{
  await edit(page,"hero_title","Tên trong lúc lưu");let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route("**/api/admin/site-settings",async route=>{if(route.request().method()==="PATCH")await gate;await route.continue();});
  await actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("textbox")).toBeDisabled();release();await expect(page.getByRole("status")).toContainText("Đã lưu");
  await page.keyboard.press("Escape");await expect(page.locator('[data-admin-direct-target="hero_title"]')).toBeFocused();
});
await run("CTA label and URL edit together without following the link",async page=>{
  await edit(page,"hero_primary_cta_label","Khám phá dịch vụ");await page.getByLabel("Đường dẫn khi bấm nút").fill("/dich-vu-moi");
  await expect(page.locator("#section_250108065 a.nut-xem-them1")).toHaveAttribute("href","/dich-vu-moi");await expect(page).toHaveURL(origin+"/");
});
await run("Dirty navigation offers stay, preserving text",async page=>{await edit(page,"hero_title","Bản đang sửa");await page.getByRole("button",{name:"Đóng chỉnh sửa trực tiếp"}).click();await page.getByRole("link",{name:"Giỏ hàng, 0 sản phẩm"}).click();await expect(page.getByRole("dialog",{name:"Rời trang đang sửa?"})).toBeVisible();await page.getByRole("button",{name:"Ở lại",exact:true}).click();await expect(page.locator('[data-admin-direct-target="hero_title"]')).toHaveText("Bản đang sửa");});
for (const width of [390,768,1440]) await run(`Editor and save controls stay reachable at ${width}px`,async page=>{
  const banner=await page.getByRole("region",{name:"Trạng thái storefront quản trị"}).boundingBox();
  const toolbar=await page.locator('[aria-label="Vùng trang web có thể chỉnh sửa"]').boundingBox();
  assert.ok(banner && toolbar && banner.y+banner.height<=toolbar.y,"Status banner must not cover editor toolbar");
  await edit(page,"hero_title","Gia công theo yêu cầu");
  await expect(actions(page).getByRole("button",{name:"Lưu bản nháp",exact:true})).toBeInViewport();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:`${output}/editor-${width}.png`});
},width);
await browser.close();await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
