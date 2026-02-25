import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

const OfflineIndicator = () => {
  const { online, pendingCount, syncNow } = useOfflineSync();

  if (online && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-accent/90 px-3 py-2 text-sm text-accent-foreground shadow-lg backdrop-blur-sm">
      {!online ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline mode</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="h-4 w-4" />
          <span>{pendingCount} pending</span>
          <button onClick={syncNow} className="ml-1 rounded p-1 hover:bg-primary/20">
            <RefreshCw className="h-3 w-3" />
          </button>
        </>
      ) : null}
    </div>
  );
};

export default OfflineIndicator;
