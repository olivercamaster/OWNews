import { useEffect, useRef, useState } from 'react';
import * as Network from 'expo-network';

/** Returns current online state, polling every 15 s. */
export function useConnectivity(): boolean {
  const [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setOnline(state.isInternetReachable !== false);
    } catch {
      // If expo-network throws, assume online to avoid false offline banners
    }
  };

  useEffect(() => {
    check();
    timer.current = setInterval(check, 15_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return online;
}
