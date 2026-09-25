// ============================================================================
// B2B CRM Core Types & Data Contracts (Lean V1 Cloudflare-Native)
// Zero external dependencies - pure TypeScript & schema validation adapters
// ============================================================================

export type CrmIndustry =
  | "mechanical_cnc"
  | "sheet_metal"
  | "plastic_injection"
  | "casting_forging"
  | "apparel_textile"
  | "packaging_carton"
  | "electronics_pcba"
  | "wood_furniture"
  | "automation_jigs"
  | "other";

export type CrmCustomerTier = "vip" | "strategic" | "potential" | "standard" | "dormant";
export type CrmCustomerStatus = "prospect" | "active" | "inactive" | "blacklisted" | "suspended";
export type CrmCreditStatus = "prepaid_only" | "good" | "warning" | "bad_debt" | "frozen";
export type CrmAcquisitionChannel =
  | "inbound_web"
  | "zalo_oa"
  | "hotline"
  | "trade_show"
  | "referral"
  | "outbound_hunting"
  | "bidding_platform";

export interface CrmCustomer {
  id: string;
  code: string;
  company_name: string;
  short_name: string | null;
  tax_code: string | null;
  industry: CrmIndustry;
  tier: CrmCustomerTier;
  status: CrmCustomerStatus;
  credit_status: CrmCreditStatus;
  credit_limit: number;
  credit_term_days: number;
  headquarters_address: string | null;
  factory_address: string | null;
  city: string | null;
  country: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  assigned_manager_id: string | null;
  source_lead_id: string | null;
  acquisition_channel: CrmAcquisitionChannel;
  required_certifications_json: string;
  internal_notes: string | null;
  total_rfq_count: number;
  total_quote_count: number;
  total_won_orders_count: number;
  total_won_value: number;
  last_interaction_at: string | null;
  last_order_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface CrmCustomerCreateInput {
  code?: string;
  company_name: string;
  short_name?: string | null;
  tax_code?: string | null;
  industry: CrmIndustry;
  tier?: CrmCustomerTier;
  status?: CrmCustomerStatus;
  credit_status?: CrmCreditStatus;
  credit_limit?: number;
  credit_term_days?: number;
  headquarters_address?: string | null;
  factory_address?: string | null;
  city?: string | null;
  country?: string;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  assigned_manager_id?: string | null;
  source_lead_id?: string | null;
  acquisition_channel?: CrmAcquisitionChannel;
  required_certifications_json?: string;
  internal_notes?: string | null;
}

export interface CrmContact {
  id: string;
  customer_id: string;
  full_name: string;
  job_title: string | null;
  department:
    | "procurement"
    | "engineering_rd"
    | "quality_assurance"
    | "production"
    | "finance_accounting"
    | "executive_board"
    | "other";
  email: string | null;
  phone: string | null;
  zalo_number: string | null;
  is_primary: number;
  is_decision_maker: number;
  status: "active" | "inactive" | "left_company";
  notes: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export type CrmTimelineEventType =
  | "note_internal"
  | "call_outgoing"
  | "call_incoming"
  | "zalo_chat"
  | "email_sent"
  | "meeting_client"
  | "technical_dfm_review"
  | "cad_drawing_uploaded"
  | "site_audit_visit"
  | "sample_dispatched"
  | "quote_delivered"
  | "price_negotiation"
  | "contract_signed";

export interface CrmTimelineEvent {
  id: string;
  customer_id: string;
  lead_id: string | null;
  quote_id: string | null;
  author_id: string;
  author_name: string;
  event_type: CrmTimelineEventType;
  title: string;
  content: string;
  metadata_json: string;
  is_pinned: number;
  requires_followup: number;
  followup_due_at: string | null;
  followup_completed: number;
  created_at: string;
}

export interface CrmTag {
  id: string;
  name: string;
  color_hex: string;
  category: "lead_status" | "sales_priority" | "capability_match" | "risk_flag" | "custom";
  description: string | null;
}

export interface CustomerDetailResponse {
  customer: CrmCustomer;
  contacts: CrmContact[];
  timeline: CrmTimelineEvent[];
  tags: CrmTag[];
}

export interface CustomersListResponse {
  customers: CrmCustomer[];
  total: number;
  limit: number;
  offset: number;
}

// ----------------------------------------------------------------------------
// Pure validation parsers
// ----------------------------------------------------------------------------

export function parseInsertCrmCustomerPayload(value: unknown): {
  fieldErrors: Record<string, string>;
  input: CrmCustomerCreateInput | null;
} {
  const fieldErrors: Record<string, string> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { fieldErrors: { form: "Dữ liệu khách hàng không hợp lệ." }, input: null };
  }

  const record = value as Record<string, unknown>;
  const companyName = typeof record.company_name === "string" ? record.company_name.trim() : "";
  if (!companyName || companyName.length < 2 || companyName.length > 255) {
    fieldErrors.company_name = "Tên công ty phải từ 2 đến 255 ký tự.";
  }

  const industry = (typeof record.industry === "string" ? record.industry.trim() : "other") as CrmIndustry;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, input: null };
  }

  const input: CrmCustomerCreateInput = {
    code: typeof record.code === "string" && record.code.trim() ? record.code.trim() : undefined,
    company_name: companyName,
    short_name: typeof record.short_name === "string" ? record.short_name.trim() : null,
    tax_code: typeof record.tax_code === "string" ? record.tax_code.trim() : null,
    industry,
    tier: (typeof record.tier === "string" ? record.tier : "standard") as CrmCustomerTier,
    status: (typeof record.status === "string" ? record.status : "active") as CrmCustomerStatus,
    credit_status: (typeof record.credit_status === "string" ? record.credit_status : "good") as CrmCreditStatus,
    credit_limit: typeof record.credit_limit === "number" ? record.credit_limit : 0,
    credit_term_days: typeof record.credit_term_days === "number" ? record.credit_term_days : 0,
    headquarters_address: typeof record.headquarters_address === "string" ? record.headquarters_address.trim() : null,
    factory_address: typeof record.factory_address === "string" ? record.factory_address.trim() : null,
    city: typeof record.city === "string" ? record.city.trim() : null,
    country: typeof record.country === "string" ? record.country.trim() : "VN",
    website: typeof record.website === "string" ? record.website.trim() : null,
    phone: typeof record.phone === "string" ? record.phone.trim() : null,
    email: typeof record.email === "string" ? record.email.trim() : null,
    assigned_manager_id: typeof record.assigned_manager_id === "string" ? record.assigned_manager_id.trim() : null,
    source_lead_id: typeof record.source_lead_id === "string" ? record.source_lead_id.trim() : null,
    acquisition_channel: (typeof record.acquisition_channel === "string" ? record.acquisition_channel : "inbound_web") as CrmAcquisitionChannel,
    required_certifications_json: typeof record.required_certifications_json === "string" ? record.required_certifications_json : "[]",
    internal_notes: typeof record.internal_notes === "string" ? record.internal_notes.trim() : null,
  };

  return { fieldErrors, input };
}

// Validation adapter for safeParse
export const insertCrmCustomerSchema = {
  safeParse(value: unknown) {
    const { fieldErrors, input } = parseInsertCrmCustomerPayload(value);
    if (Object.keys(fieldErrors).length > 0 || !input) {
      const errorList = Object.entries(fieldErrors).map(([field, message]) => ({ path: [field], message }));
      return { success: false as const, error: { errors: errorList } };
    }
    return { success: true as const, data: input };
  },
};

export const updateCrmCustomerSchema = {
  safeParse(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { success: false as const, error: { errors: [{ path: ["form"], message: "Dữ liệu không hợp lệ" }] } };
    }
    const record = value as Record<string, unknown>;
    const revision = typeof record.revision === "number" ? record.revision : 1;
    return { success: true as const, data: { ...record, revision } };
  },
};

export const insertCrmTimelineEventSchema = {
  safeParse(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { success: false as const, error: { errors: [{ path: ["form"], message: "Dữ liệu sự kiện không hợp lệ" }] } };
    }
    const record = value as Record<string, unknown>;
    return {
      success: true as const,
      data: {
        lead_id: typeof record.lead_id === "string" ? record.lead_id : null,
        quote_id: typeof record.quote_id === "string" ? record.quote_id : null,
        event_type: typeof record.event_type === "string" ? (record.event_type as CrmTimelineEventType) : "note_internal",
        title: typeof record.title === "string" ? record.title : typeof record.summary === "string" ? record.summary : "Ghi chú",
        summary: typeof record.summary === "string" ? record.summary : "",
        content: typeof record.content === "string" ? record.content : typeof record.details === "string" ? record.details : "",
        details: typeof record.details === "string" ? record.details : "",
        metadata_json: typeof record.metadata_json === "string" ? record.metadata_json : "{}",
        is_pinned: typeof record.is_pinned === "number" ? record.is_pinned : 0,
        requires_followup: typeof record.requires_followup === "number" ? record.requires_followup : 0,
        followup_due_at: typeof record.followup_due_at === "string" ? record.followup_due_at : null,
      },
    };
  },
};

export const insertCrmContactSchema = {
  safeParse(value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { success: false as const, error: { errors: [{ path: ["form"], message: "Dữ liệu liên hệ không hợp lệ" }] } };
    }
    const record = value as Record<string, unknown>;
    return { success: true as const, data: record };
  },
};
