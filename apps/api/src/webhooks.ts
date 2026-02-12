import crypto from "node:crypto";

export interface WebhookTarget {
  id: string;
  url: string;
  createdAt: string;
}

export interface WebhookEventPayload<TData = Record<string, unknown>> {
  id: string;
  type: "transfer.submitted" | "transfer.settled" | "transfer.failed";
  timestamp: string;
  data: TData;
}

interface QueueItem {
  target: WebhookTarget;
  event: WebhookEventPayload;
  attempt: number;
  nextAttemptAt: number;
}

const RETRY_DELAYS_MS = [1000, 3000, 7000];

export class WebhookDispatcher {
  private targets: WebhookTarget[] = [];
  private queue: QueueItem[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly secret: string) {
    this.timer = setInterval(() => {
      void this.processQueue();
    }, 500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  listTargets(): WebhookTarget[] {
    return [...this.targets];
  }

  registerTarget(url: string): WebhookTarget {
    const existing = this.targets.find((target) => target.url === url);
    if (existing) return existing;

    const target: WebhookTarget = {
      id: `wh_${Math.random().toString(36).slice(2, 10)}`,
      url,
      createdAt: new Date().toISOString()
    };
    this.targets.push(target);
    return target;
  }

  signPayload(rawPayload: string): string {
    return crypto.createHmac("sha256", this.secret).update(rawPayload).digest("hex");
  }

  enqueueEvent(event: WebhookEventPayload): void {
    for (const target of this.targets) {
      this.queue.push({
        target,
        event,
        attempt: 0,
        nextAttemptAt: Date.now()
      });
    }
  }

  private async processQueue(): Promise<void> {
    const now = Date.now();
    const dueItems = this.queue.filter((item) => item.nextAttemptAt <= now);
    this.queue = this.queue.filter((item) => item.nextAttemptAt > now);

    for (const item of dueItems) {
      const ok = await this.deliver(item.target, item.event);
      if (!ok && item.attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[item.attempt];
        this.queue.push({
          ...item,
          attempt: item.attempt + 1,
          nextAttemptAt: Date.now() + delay
        });
      }
    }
  }

  private async deliver(target: WebhookTarget, event: WebhookEventPayload): Promise<boolean> {
    const rawPayload = JSON.stringify(event);
    const signature = this.signPayload(rawPayload);

    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-railagent-signature": signature,
          "x-railagent-event": event.type
        },
        body: rawPayload
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export function createWebhookEvent<TData = Record<string, unknown>>(
  type: WebhookEventPayload<TData>["type"],
  data: TData
): WebhookEventPayload<TData> {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    type,
    timestamp: new Date().toISOString(),
    data
  };
}
