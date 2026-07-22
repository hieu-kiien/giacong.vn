import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { callAdminApi, type AdminUpstreamResult } from "@/lib/admin-bff";
import { parseAdminIdentity, parseDashboard, parseProductDetail, parseProductList, type AdminIdentity, type AdminProductDetail, type AdminProductList, type AdminDashboard } from "@/lib/admin-contract";

async function serverRequest(): Promise<Request> { const source = await headers(); return new Request("http://127.0.0.1/quan-tri", { headers: { cookie: source.get("cookie") ?? "" } }); }
async function result(operation: "me" | "dashboard" | "products" | "product", options?: { query?: URLSearchParams; slug?: string }): Promise<AdminUpstreamResult> { return callAdminApi(await serverRequest(), operation, options); }
export const getAdmin = cache(async (): Promise<AdminSession> => {
  try { const response = await result("me"); if (response.status === 401) return { kind: "unauthenticated" }; if (response.status !== 200) return { kind: "unavailable" }; return { kind: "authenticated", admin: parseAdminIdentity(response.payload) }; } catch { return { kind: "unavailable" }; }
});
export async function getDashboard(): Promise<AdminDashboard | null> { return parseResult("dashboard", parseDashboard); }
export async function getProducts(query: URLSearchParams): Promise<AdminProductList | null> { return parseResult("products", parseProductList, { query }); }
export async function getAdminProduct(slug: string): Promise<AdminProductResult> {
  try {
    const response = await result("product", { slug });
    if (response.status === 404) return { kind: "not_found" };
    if (response.status !== 200) return { kind: "unavailable" };
    if (!response.etag) return { kind: "unavailable" };
    return { kind: "found", product: parseProductDetail(response.payload, response.etag) };
  } catch {
    return { kind: "unavailable" };
  }
}
export function can(admin: AdminIdentity, permission: "b2b.dashboard" | "b2b.catalog.read" | "b2b.catalog.write") { return admin.permissions.includes("*") || admin.permissions.includes(permission); }
export function safeReturnTo(value: string | null): string { return value && /^\/quan-tri(?:\/san-pham(?:\/[a-z0-9-]+)?)?(?:\?[^#]*)?$/i.test(value) ? value : "/quan-tri"; }
export type AdminSession = { kind: "authenticated"; admin: AdminIdentity } | { kind: "unauthenticated" } | { kind: "unavailable" };
export type AdminProductResult = { kind: "found"; product: AdminProductDetail } | { kind: "not_found" } | { kind: "unavailable" };
async function parseResult<T>(operation: "dashboard" | "products" | "product", parser: (payload: unknown) => T, options?: { query?: URLSearchParams; slug?: string }): Promise<T | null> { try { const response = await result(operation, options); return response.status === 200 ? parser(response.payload) : null; } catch { return null; } }
