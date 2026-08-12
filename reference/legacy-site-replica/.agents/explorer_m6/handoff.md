# Handoff Report — Milestone 6 Investigation

## 1. Observation

During our investigation, we observed the following file structures and contents:

### A. robots.txt
File path: `frontend/public/robots.txt`
```txt
1: User-agent: *
2: Allow: /
3: Disallow: /search
4: 
5: Sitemap: https://giacong.vn/sitemap.xml
```
*Observation*: Line 5 explicitly points to the correct production sitemap address.

### B. package.json Build Scripts
File path: `frontend/package.json`
```json
5:   "scripts": {
6:     "dev": "next dev",
7:     "build": "node scripts/generate-sitemap.js && next build",
8:     "start": "next start",
9:     "lint": "eslint"
10:   },
```
*Observation*: The `build` script chain executes `node scripts/generate-sitemap.js` sequentially before starting `next build`.

### C. generate-sitemap.js
File path: `frontend/scripts/generate-sitemap.js`
*Observation*: The script dynamically parses pages from `frontend/src/data/metadata.json`, filters out urls with titles containing "page not found" (case-insensitive), resolves the main home slug, deduplicates the slugs, formats them into a valid `<urlset>` XML structure, and writes to `frontend/public/sitemap.xml`.

### D. verify-seo.js Execution
Running `node scripts/verify-seo.js` inside the `frontend` folder outputs:
```
--- Verifying SEO Assets ---
✅ Pass: robots.txt allows all
✅ Pass: robots.txt disallows /search
✅ Pass: robots.txt references sitemap.xml
✅ Pass: sitemap.xml contains mapped home page
✅ Pass: sitemap.xml does not contain any "Page Not Found" pages
--- All SEO asset checks passed successfully ---
```

### E. Trademark and Brand Usage Guide
Proposed file path: `.agents/explorer_m6/proposed_TRADEMARK_BRAND_GUIDE.md`
*Observation*: Content has been successfully designed and drafted in Vietnamese and English, establishing rules for replica/development environment naming, SEO headers (`noindex, nofollow`), staging banners, form redirection, and palette specifications (`#5aa400` / `#eb892d`).

---

## 2. Logic Chain

1. **robots.txt linking to sitemap**: From Observation A, line 5 contains `Sitemap: https://giacong.vn/sitemap.xml`. Therefore, the `robots.txt` correctly references the sitemap.
2. **Sitemap generation during production build**: From Observation B, line 7 defines the build script as `node scripts/generate-sitemap.js && next build`. Because `&&` is used, the sitemap generation must execute first and complete successfully before the Next.js compiler runs.
3. **Execution correctness**: Running `node scripts/generate-sitemap.js` successfully creates `sitemap.xml` with 799 entries. Running the SEO verification script (`node scripts/verify-seo.js`) passes all assertions (Observation D).
4. **Trademark/Brand Guide**: Since the user request specified that we are a read-only Explorer and must not modify codebase files (i.e. cannot write to the project root), we have drafted the designed contents into a replacement file at `.agents/explorer_m6/proposed_TRADEMARK_BRAND_GUIDE.md` (Observation E) for the implementer to copy and paste to the root as `TRADEMARK_BRAND_GUIDE.md`.

---

## 3. Caveats

* No caveats. All investigated targets are explicitly specified, functional, and fully verified.

---

## 4. Conclusion

1. **SEO Files**: The SEO setup is correct, and automated. Robots.txt points to the correct sitemap location, and sitemap generation is hooked directly into the production build sequence.
2. **Brand Guide**: The designed guidelines prevent public confusion of replica environments with the official `giacong.vn` website by detailing required disclaimers, domain boundaries, form behaviors, and SEO blocks.

---

## 5. Verification Method

To verify these conclusions:
1. Run sitemap generation manually:
   ```powershell
   cd frontend
   node scripts/generate-sitemap.js
   ```
   *Expected outcome*: `Successfully generated sitemap.xml with 799 entries.`
2. Run the SEO assertion tests:
   ```powershell
   node scripts/verify-seo.js
   ```
   *Expected outcome*: All checks pass with `Pass: ...` and exit code `0`.
3. Check that the trademark guide content is generated:
   Inspect `.agents/explorer_m6/proposed_TRADEMARK_BRAND_GUIDE.md` to verify the designed content.
