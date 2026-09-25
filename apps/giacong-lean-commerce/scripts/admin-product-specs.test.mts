import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Product Tech Specs API Route Contract", async () => {
  const specsRoute = await readFile(new URL("../src/app/api/admin/products/[id]/specs/route.ts", import.meta.url), "utf8");
  
  assert.match(specsRoute, /canManageCatalog\(guard\.member\.role\)/, "Should enforce catalog management capability");
  assert.match(specsRoute, /UPDATE product_tech_specs|INSERT INTO product_tech_specs/, "Should contain tech specs insertion/update logic");
  assert.match(specsRoute, /STALE_WRITE|revision/, "Should check revisions for concurrency locking");
});

test("Product Gallery API Route Contract", async () => {
  const galleryRoute = await readFile(new URL("../src/app/api/admin/products/[id]/gallery/route.ts", import.meta.url), "utf8");
  
  assert.match(galleryRoute, /canManageCatalog\(guard\.member\.role\)/, "Should enforce catalog management capability");
  assert.match(galleryRoute, /product_gallery|product_images/, "Should contain gallery table reference");
});

test("Product Variants API Route Contract", async () => {
  const variantsRoute = await readFile(new URL("../src/app/api/admin/products/[id]/variants/route.ts", import.meta.url), "utf8");
  
  assert.match(variantsRoute, /canManageCatalog\(guard\.member\.role\)/, "Should enforce catalog management capability");
  assert.match(variantsRoute, /createAdminProductVariantAtomically/, "Should call atomic variant creator");
});

test("Product Gallery & Specs Component Contract", async () => {
  const specsComponent = await readFile(new URL("../src/components/admin/AdminProductTechSpecs.tsx", import.meta.url), "utf8");
  const galleryComponent = await readFile(new URL("../src/components/admin/AdminProductGalleryManager.tsx", import.meta.url), "utf8");

  // Basic sanity check that they export the components
  assert.match(specsComponent, /export.*AdminProductTechSpecs/, "Should export AdminProductTechSpecs component");
  assert.match(galleryComponent, /export.*AdminProductGalleryManager/, "Should export AdminProductGalleryManager component");
});
