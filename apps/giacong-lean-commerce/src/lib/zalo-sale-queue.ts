import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface ZaloSaleDeliveryMessage {
  type: "zalo-sale";
  saleId: string;
}

interface QueueBinding {
  send(message: ZaloSaleDeliveryMessage): Promise<void>;
}

interface ZaloSaleQueueEnvironment {
  GIACONG_VN_LEAD_QUEUE?: QueueBinding;
  GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
  GOOGLE_SHEETS_WEBHOOK_URL?: string;
}

export interface ZaloSaleDeliveryBindings {
  environment: Readonly<Record<string, string | undefined>>;
  queue?: QueueBinding;
}

export function getZaloSaleDeliveryBindings(): ZaloSaleDeliveryBindings {
  try {
    const { env } = getCloudflareContext();
    const bindings = env as unknown as ZaloSaleQueueEnvironment;
    return {
      environment: {
        GOOGLE_SHEETS_WEBHOOK_SECRET: bindings.GOOGLE_SHEETS_WEBHOOK_SECRET,
        GOOGLE_SHEETS_WEBHOOK_URL: bindings.GOOGLE_SHEETS_WEBHOOK_URL,
      },
      queue: bindings.GIACONG_VN_LEAD_QUEUE,
    };
  } catch {
    return { environment: {} };
  }
}
