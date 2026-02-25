import { useEffect, useState, useCallback } from "react";
import { syncQueue, getQueuedActions, isOnline } from "@/lib/offlineQueue";
import { toast } from "sonner";

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);

  const checkPending = useCallback(async () => {
    try {
      const actions = await getQueuedActions();
      setPendingCount(actions.length);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  const doSync = useCallback(async () => {
    const pending = await getQueuedActions();
    if (pending.length === 0) return;

    toast.info(`Syncing ${pending.length} offline change(s)...`);
    const { synced, failed } = await syncQueue();

    if (synced > 0) toast.success(`${synced} change(s) synced successfully!`);
    if (failed > 0) toast.error(`${failed} change(s) failed to sync. Will retry later.`);

    await checkPending();
  }, [checkPending]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success("You're back online!");
      doSync();
    };
    const handleOffline = () => {
      setOnline(false);
      toast.warning("You're offline. Changes will be saved and synced when you reconnect.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    checkPending();

    // Try syncing on mount if online
    if (isOnline()) doSync();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [doSync, checkPending]);

  return { online, pendingCount, syncNow: doSync };
}
