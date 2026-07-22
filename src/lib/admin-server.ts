import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { callAdminApi, type AdminUpstreamResult } from "@/lib/admin-bff";
import { parseAdminIdentity, parseDashboard, parseProductDetail, parseProductList, type AdminIdentity, type AdminProductDetail, type AdminProductList, type AdminDashboard } from "@/lib/admin-contract";

async function serverRequest(): Promise<Request> { const source = await headers(); return new Request("http://127.0.0.1/quan-tri", { headers: { cookie: source.get("cookie") ?? "" } }); }
async function result(operation: "me" | "dashboard" | "products" | "product", options?: { query?: URLSearchParams; slug?: string }): Promise<AdminUpstreamResult> { return callAdminApi(await serverRequest(), operation, options); }
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => { const response = await result("me"); return response.status === 200 ? parseAdminIdentity(response.payload) : null; });
export async function getDashboard(): Promise<AdminDashboard | null> { const response = await result("dashboard"); return response.status === 200 ? parseDashboard(response.payload) : null; }
export async function getProducts(query: URLSearchParams): Promise<AdminProductList | null> { const response = await result("products", { query }); return response.status === 200 ? parseProductList(response.payload) : null; }
export async function getProduct(slug: string): Promise<AdminProductDetail | null> { const response = await result("product", { slug }); return response.status === 200 ? parseProductDetail(response.payload) : null; }
export function can(admin: AdminIdentity, permission: "b2b.dashboard" | "b2b.catalog.read") { return admin.permissions.includes("*") || admin.permissions.includes(permission); }
export function safeReturnTo(value: string | null): string { return value && /^\/quan-tri(?:\/san-pham(?:\/[a-z0-9-]+)?)?(?:\?[^#]*)?$/i.test(value) ? value : "/quan-tri"; }
