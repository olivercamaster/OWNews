import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Network from 'expo-network';

/**
 * Estado online. Reage na hora à mudança de rede (listener do sistema; na web,
 * eventos online/offline do navegador) e ainda confere a cada 15 s como rede de segurança.
 */
export function useConnectivity(): boolean {
  const [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setOnline(state.isInternetReachable !== false && state.isConnected !== false);
    } catch {
      // If expo-network throws, assume online to avoid false offline banners
    }
  };

  useEffect(() => {
    check();
    timer.current = setInterval(check, 15_000);
    let sub: { remove: () => void } | null = null;
    try {
      sub = Network.addNetworkStateListener(s => setOnline(s.isInternetReachable !== false && s.isConnected !== false));
    } catch {}
    const naWeb = Platform.OS === 'web' && typeof window !== 'undefined';
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    if (naWeb) { window.addEventListener('online', on); window.addEventListener('offline', off); }
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub?.remove();
      if (naWeb) { window.removeEventListener('online', on); window.removeEventListener('offline', off); }
    };
  }, []);

  return online;
}
