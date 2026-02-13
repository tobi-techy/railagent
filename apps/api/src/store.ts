import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type TransferState = "submitted" | "settled" | "failed";

export interface PersistedTransfer {
  id: string;
  quoteId: string;
  recipient: string;
  amount: number;
  fromToken: string;
  toToken: string;
  providerName: string;
  providerMode: "mock" | "live";
  status: TransferState;
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
  stateHistory: Array<{ status: TransferState; timestamp: string; txHash?: string }>;
}

export class SqliteTransferStore {
  private readonly db: DatabaseSync;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec("PRAGMA foreign_keys=ON;");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quote_snapshots (
        quote_id TEXT PRIMARY KEY,
        from_token TEXT NOT NULL,
        to_token TEXT NOT NULL,
        amount REAL NOT NULL,
        payload_json TEXT NOT NULL,
        provider_mode TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL,
        recipient TEXT NOT NULL,
        amount REAL NOT NULL,
        from_token TEXT NOT NULL,
        to_token TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        provider_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transfer_idempotency (
        idempotency_key TEXT PRIMARY KEY,
        transfer_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(transfer_id) REFERENCES transfers(id)
      );

      CREATE TABLE IF NOT EXISTS transfer_state_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT NOT NULL,
        status TEXT NOT NULL,
        tx_hash TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(transfer_id) REFERENCES transfers(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_history_transfer_id ON transfer_state_history(transfer_id, id);
    `);
  }

  saveQuoteSnapshot(input: {
    quoteId: string;
    fromToken: string;
    toToken: string;
    amount: number;
    payload: unknown;
    providerMode: "mock" | "live";
  }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO quote_snapshots
      (quote_id, from_token, to_token, amount, payload_json, provider_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.quoteId, input.fromToken, input.toToken, input.amount, JSON.stringify(input.payload), input.providerMode, now);
  }

  createTransfer(input: {
    id: string;
    quoteId: string;
    recipient: string;
    amount: number;
    fromToken: string;
    toToken: string;
    providerName: string;
    providerMode: "mock" | "live";
    txHash?: string;
    idempotencyKey?: string;
  }): PersistedTransfer {
    const now = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
      this.db.prepare(`
        INSERT INTO transfers
        (id, quote_id, recipient, amount, from_token, to_token, provider_name, provider_mode, status, tx_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
      `).run(
        input.id,
        input.quoteId,
        input.recipient,
        input.amount,
        input.fromToken,
        input.toToken,
        input.providerName,
        input.providerMode,
        input.txHash ?? null,
        now,
        now
      );

      this.db.prepare(`
        INSERT INTO transfer_state_history (transfer_id, status, tx_hash, timestamp)
        VALUES (?, 'submitted', ?, ?)
      `).run(input.id, input.txHash ?? null, now);

      if (input.idempotencyKey) {
        this.db.prepare(`
          INSERT OR REPLACE INTO transfer_idempotency (idempotency_key, transfer_id, created_at)
          VALUES (?, ?, ?)
        `).run(input.idempotencyKey, input.id, now);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getTransfer(input.id)!;
  }

  getTransfer(id: string): PersistedTransfer | undefined {
    const row = this.db.prepare(`SELECT * FROM transfers WHERE id = ?`).get(id) as any;
    if (!row) return undefined;
    const historyRows = this.db.prepare(
      `SELECT status, tx_hash, timestamp FROM transfer_state_history WHERE transfer_id = ? ORDER BY id ASC`
    ).all(id) as any[];

    return {
      id: row.id,
      quoteId: row.quote_id,
      recipient: row.recipient,
      amount: row.amount,
      fromToken: row.from_token,
      toToken: row.to_token,
      providerName: row.provider_name,
      providerMode: row.provider_mode,
      status: row.status,
      txHash: row.tx_hash ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      idempotencyKey: this.getIdempotencyKeyByTransferId(row.id),
      stateHistory: historyRows.map((h) => ({ status: h.status, timestamp: h.timestamp, txHash: h.tx_hash ?? undefined }))
    };
  }

  getTransferByIdempotencyKey(key: string): PersistedTransfer | undefined {
    const row = this.db.prepare(`SELECT transfer_id FROM transfer_idempotency WHERE idempotency_key = ?`).get(key) as any;
    if (!row) return undefined;
    return this.getTransfer(row.transfer_id);
  }

  private getIdempotencyKeyByTransferId(transferId: string): string | undefined {
    const row = this.db.prepare(`SELECT idempotency_key FROM transfer_idempotency WHERE transfer_id = ?`).get(transferId) as any;
    return row?.idempotency_key;
  }

  appendStatus(transferId: string, status: TransferState, txHash?: string): PersistedTransfer | undefined {
    const now = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
      this.db.prepare(`UPDATE transfers SET status = ?, tx_hash = ?, updated_at = ? WHERE id = ?`).run(status, txHash ?? null, now, transferId);
      this.db.prepare(`INSERT INTO transfer_state_history (transfer_id, status, tx_hash, timestamp) VALUES (?, ?, ?, ?)`).run(
        transferId,
        status,
        txHash ?? null,
        now
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.getTransfer(transferId);
  }

  listAudit(limit: number): Array<{
    id: string;
    quoteId: string;
    fromToken: string;
    toToken: string;
    amount: number;
    status: string;
    providerMode: string;
    txHash?: string;
    createdAt: string;
    updatedAt: string;
  }> {
    const rows = this.db.prepare(`
      SELECT id, quote_id, from_token, to_token, amount, status, provider_mode, tx_hash, created_at, updated_at
      FROM transfers
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      quoteId: row.quote_id,
      fromToken: row.from_token,
      toToken: row.to_token,
      amount: row.amount,
      status: row.status,
      providerMode: row.provider_mode,
      txHash: row.tx_hash ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}
