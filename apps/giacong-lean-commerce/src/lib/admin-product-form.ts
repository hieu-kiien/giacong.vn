// Payload builder for the product admin form (`src/app/admin/san-pham/page.tsx`).
//
// Form controls keep every value as a string, but the server write contract
// requires JSON numbers for numeric fields ("Numeric fields must arrive as
// JSON numbers, not numeric strings"). This builder converts the form state
// before submit. Field validation stays server-side.
export interface AdminProductFormState {
  categoryId: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  leadTimeDays: string;
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
  status: string;
}

export interface AdminProductFormPayload {
  categoryId: number | null;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  leadTimeDays: number | null;
  name: string;
  requestId: string;
  shortDescription: string;
  sku: string;
  slug: string;
  status: string;
}

export function buildAdminProductPayload(
  editor: AdminProductFormState,
  requestId: string,
): AdminProductFormPayload {
  return {
    categoryId: editor.categoryId === "" ? null : Number(editor.categoryId),
    description: editor.description,
    imageUrl: editor.imageUrl || null,
    isActive: editor.isActive,
    leadTimeDays: editor.leadTimeDays === "" ? null : Number(editor.leadTimeDays),
    name: editor.name,
    requestId,
    shortDescription: editor.shortDescription,
    sku: editor.sku,
    slug: editor.slug,
    status: editor.status,
  };
}
