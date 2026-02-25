import { supabase } from "@/integrations/supabase/client";

interface QueuedAction {
  id: string;
  table: string;
  type: "insert" | "update" | "delete";
  data: Record<string, unknown>;
  timestamp: number;
}

const DB_NAME = "mcr-offline-queue";
const STORE_NAME = "actions";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueAction(action: Omit<QueuedAction, "id" | "timestamp">) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const entry: QueuedAction = {
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  store.add(entry);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeAction(id: string) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const actions = await getQueuedActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions.sort((a, b) => a.timestamp - b.timestamp)) {
    try {
      if (action.type === "insert") {
        const { error } = await supabase.from(action.table as any).insert(action.data as any);
        if (error) throw error;
      } else if (action.type === "update") {
        const { id: rowId, ...rest } = action.data;
        const { error } = await supabase
          .from(action.table as any)
          .update(rest as any)
          .eq("id", rowId as string);
        if (error) throw error;
      } else if (action.type === "delete") {
        const { error } = await supabase
          .from(action.table as any)
          .delete()
          .eq("id", action.data.id as string);
        if (error) throw error;
      }
      await removeAction(action.id);
      synced++;
    } catch (err) {
      console.error("Sync failed for action:", action, err);
      failed++;
    }
  }

  return { synced, failed };
}

export function isOnline(): boolean {
  return navigator.onLine;
}
