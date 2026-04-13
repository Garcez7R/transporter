import { useState, useEffect } from 'react';

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnline: Date | null;
}

export function useOffline(): OfflineState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setLastOnline(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOnline(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline, lastOnline };
}

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      setIsSupported(true);

      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(registration => {
          setIsRegistered(true);
          console.log('Service Worker registered:', registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const updateServiceWorker = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.update().then(() => {
          window.location.reload();
        });
      });
    }
  };

  return { isSupported, isRegistered, updateAvailable, updateServiceWorker };
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
}

export function useCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = 5 * 60 * 1000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached) {
      try {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) {
          setData(cachedData);
          return;
        }
      } catch (e) {
        // Invalid cache, continue to fetch
      }
    }

    setLoading(true);
    fetcher()
      .then(data => {
        setData(data);
        localStorage.setItem(`cache_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [key, ttl]);

  return { data, loading, error, refetch: () => {
    setLoading(true);
    fetcher()
      .then(data => {
        setData(data);
        localStorage.setItem(`cache_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }};
}
