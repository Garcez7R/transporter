import { useState, useEffect, useCallback } from 'react';
import type { TripRequest } from '../types';

type GPSTrackingProps = {
  request: TripRequest;
  onLocationUpdate?: (location: { lat: number; lng: number; timestamp: Date }) => void;
};

type LocationData = {
  lat: number;
  lng: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
};

export function GPSTracking({ request, onLocationUpdate }: GPSTrackingProps) {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [trackingError, setTrackingError] = useState('');

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setTrackingError('Geolocalização não é suportada neste navegador.');
      return;
    }

    setTrackingError('');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const location: LocationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: new Date(),
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || 0
      };

      setCurrentLocation(location);
      setLocationHistory((prev) => [...prev, location]);
      setIsTracking(true);

      const id = navigator.geolocation.watchPosition(
        (nextPosition) => {
          const newLocation: LocationData = {
            lat: nextPosition.coords.latitude,
            lng: nextPosition.coords.longitude,
            timestamp: new Date(),
            accuracy: nextPosition.coords.accuracy,
            speed: nextPosition.coords.speed || 0
          };

          setCurrentLocation(newLocation);
          setLocationHistory((prev) => [...prev, newLocation].slice(-50));
          onLocationUpdate?.(newLocation);
        },
        () => {
          setTrackingError('Não foi possível manter o rastreamento. Verifique a permissão de localização.');
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );

      setWatchId(id);
    } catch {
      setTrackingError('Não foi possível obter a localização inicial do motorista.');
    }
  }, [onLocationUpdate]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const getMapUrl = useCallback(() => {
    if (!currentLocation) return '';
    const destination = request.destinationFacility || request.destination;
    return `https://www.google.com/maps/dir/${currentLocation.lat},${currentLocation.lng}/${encodeURIComponent(destination)}`;
  }, [currentLocation, request.destination, request.destinationFacility]);

  return (
    <div className="gps-tracking">
      <div className="section-head compact">
        <p className="eyebrow">GPS operacional</p>
        <h3>Rastreamento da viagem</h3>
      </div>

      <p className="helper-text">
        Esta área mostra posição atual do navegador, histórico curto da sessão e envia pontos de rastreio para o backend sempre que o navegador reporta nova posição.
      </p>

      {trackingError ? (
        <div className="banner banner-error">
          <strong>Falha no GPS</strong>
          <p>{trackingError}</p>
        </div>
      ) : null}

      <div className="tracking-controls">
        {!isTracking ? (
          <button className="cta" type="button" onClick={startTracking}>
            Iniciar rastreamento
          </button>
        ) : (
          <button className="cta danger" type="button" onClick={stopTracking}>
            Parar rastreamento
          </button>
        )}

        {currentLocation ? (
          <a href={getMapUrl()} target="_blank" rel="noopener noreferrer" className="cta ghost">
            Abrir no Maps
          </a>
        ) : null}
      </div>

      {currentLocation ? (
        <div className="location-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Latitude / Longitude</span>
              <span className="value">{currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</span>
            </div>
            <div className="info-item">
              <span className="label">Precisão</span>
              <span className="value">{currentLocation.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : 'não informada'}</span>
            </div>
            <div className="info-item">
              <span className="label">Velocidade</span>
              <span className="value">{currentLocation.speed ? `${Math.round(currentLocation.speed * 3.6)} km/h` : 'não informada'}</span>
            </div>
            <div className="info-item">
              <span className="label">Pontos coletados</span>
              <span className="value">{locationHistory.length}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
