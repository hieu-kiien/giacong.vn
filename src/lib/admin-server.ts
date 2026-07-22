import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { callAdminApi, type AdminUpstreamResult } from "@/lib/admin-bff";
import { parseAdminIdentity, parseDashboard, parseProductDetail, parseProductList, type AdminIdentity, type AdminProductDetail, type AdminProductList, type AdminDashboard } from "@/lib/admin-contract";

async function serverRequest(): Promise<Request> { const source = await headers(); return new Request("http://127.0.0.1/quan-tri", { headers: { cookie: source.get("cookie") ?? "" } }); }
async function result(operation: "me" | "dashboard" | "products" | "product", options?: { query?: URLSearchParams; slug?: string }): Promise<AdminUpstreamResult> { return callAdminApi(await serverRequest(), operation, options); }
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => parse(await result("me"), parseAdminIdentity));
export async function getDashboard(): Promise<AdminDashboard | null> { return parse(await result("dashboard"), parseDashboard); }
export async function getProducts(query: URLSearchParams): Promise<AdminProductList | null> { return parse(await result("products", { query }), parseProductList); }
export async function getProduct(slug: string): Promise<AdminProductDetail | null> { return parse(await result("product", { slug }), parseProductDetail); }
export function can(admin: AdminIdentity, permission: "b2b.dashboard" | "b2b.catalog.read") { return admin.permissions.includes("*") || admin.permissions.includes(permission); }
export function safeReturnTo(value: string | null): string { return value && /^\/quan-tri(?:\/san-pham(?:\/[a-z0-9-]+)?)?(?:\?[^#]*)?$/i.test(value) ? value : "/quan-tri"; }
function parse<T>(response: AdminUpstreamResult, parser: (payload: unknown) => T): T | null { if (response.status !== 200) return null; try { return parser(response.payload); } catch { return null; } }
