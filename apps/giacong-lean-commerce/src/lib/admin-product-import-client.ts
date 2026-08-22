import { AdminClientError } from "./admin-client.ts";
import type { AdminProductImportRow } from "./admin-product-import-csv.ts";

export interface AdminProductImportRowError {
  field: string;
  message: string;
  row: number;
}

export interface AdminProductImportResult {
  createdCount: number;
  productIds: number[];
}

export class AdminProductImportError extends AdminClientError {
  readonly rowErrors: AdminProductImportRowError[];

  constructor(
    message: string,
    status: number,
    code: string | undefined,
    rowErrors: AdminProductImportRowError[],
  ) {
    super(message, status, code);
    this.name = "AdminProductImportError";
    this.rowErrors = rowErrors;
  }
}

export async function importAdminProducts(
  rows: readonly AdminProductImportRow[],
): Promise<AdminProductImportResult> {
  let response: Response;
  try {
    response = await fetch("/api/admin/products/import", {
      body: JSON.stringify({ rows }),
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw new AdminProductImportError("Không thể kết nối tới máy chủ admin.", 0, "NETWORK_ERROR", []);
  }

  let body: {
    code?: string;
    data?: AdminProductImportResult;
    fieldErrors?: Record<string, string>;
    message?: string;
    ok?: boolean;
  };
  try {
    body = await response.json();
  } catch {
    throw new AdminProductImportError("Máy chủ trả về dữ liệu nhập không hợp lệ.", response.status, undefined, []);
  }

  if (!response.ok || body.ok === false || !body.data) {
    throw new AdminProductImportError(
      body.message ?? "Không thể nhập sản phẩm.",
      response.status,
      body.code,
      parseRowErrors(body.fieldErrors),
    );
  }
  return body.data;
}

function parseRowErrors(fieldErrors: Record<string, string> | undefined): AdminProductImportRowError[] {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors)
    .map(([key, message]) => {
      const match = /^row_(\d+)_(.+)$/.exec(key);
      return match
        ? { field: match[2]!, message, row: Number(match[1]) }
        : null;
    })
    .filter((error): error is AdminProductImportRowError => error !== null)
    .sort((left, right) => left.row - right.row || left.field.localeCompare(right.field));
}
