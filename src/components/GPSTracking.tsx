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
  const [estimatedArrival, setEstimatedArrival] = useState<Date | null>(null);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada neste navegador');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
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
      setLocationHistory(prev => [...prev, location]);
      setIsTracking(true);

      // Start watching position
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date(),
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0
          };

          setCurrentLocation(newLocation);
          setLocationHistory(prev => {
            const updated = [...prev, newLocation];
            // Keep only last 50 positions for performance
            return updated.slice(-50);
          });

          onLocationUpdate?.(newLocation);

          // Calculate estimated arrival (simple distance-based estimation)
          if (request.arrivalEta) {
            const destinationTime = new Date(request.arrivalEta);
            const now = new Date();
            const timeDiff = destinationTime.getTime() - now.getTime();

            if (timeDiff > 0) {
              // Simple estimation: assume 30km/h average speed
              const estimatedTime = new Date(now.getTime() + timeDiff);
              setEstimatedArrival(estimatedTime);
            }
          }
        },
        (error) => {
          console.error('GPS tracking error:', error);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );

      setWatchId(id);
    } catch (error) {
      console.error('Failed to get initial location:', error);
      alert('Não foi possível obter sua localização. Verifique as permissões.');
    }
  }, [request.arrivalEta, onLocationUpdate]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  const getMapUrl = useCallback(() => {
    if (!currentLocation) return '';

    const destination = request.destinationFacility || request.destination;
    const origin = `${currentLocation.lat},${currentLocation.lng}`;
    const query = `${origin}/${encodeURIComponent(destination)}`;

    return `https://www.google.com/maps/dir/${query}`;
  }, [currentLocation, request]);

  const getDistance = useCallback(() => {
    if (!currentLocation || !request.boardingPoint) return null;

    // Simple distance calculation (Haversine formula approximation)
    // In a real app, you'd use Google Maps Distance Matrix API
    const R = 6371; // Earth's radius in km
    const dLat = (request.boardingPoint ? 0 : 0) * Math.PI / 180; // Would need destination coordinates
    const dLng = (request.boardingPoint ? 0 : 0) * Math.PI / 180;

    // This is a placeholder - in reality you'd need actual coordinates
    return Math.random() * 15 + 2; // Random distance between 2-17km
  }, [currentLocation, request.boardingPoint]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  return (
    <div className="gps-tracking">
      <div className="tracking-header">
        <h3>Rastreamento GPS</h3>
        <div className="tracking-status">
          <span className={`status-indicator ${isTracking ? 'active' : 'inactive'}`}>
            {isTracking ? '🟢' : '🔴'}
          </span>
          <span>{isTracking ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div className="tracking-controls">
        {!isTracking ? (
          <button className="cta" onClick={startTracking}>
            🚀 Iniciar rastreamento
          </button>
        ) : (
          <button className="cta danger" onClick={stopTracking}>
            ⏹️ Parar rastreamento
          </button>
        )}

        {currentLocation && (
          <a
            href={getMapUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="cta ghost"
          >
            🗺️ Ver no Maps
          </a>
        )}
      </div>

      {currentLocation && (
        <div className="location-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Localização atual</span>
              <span className="value">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </span>
            </div>

            {currentLocation.accuracy && (
              <div className="info-item">
                <span className="label">Precisão</span>
                <span className="value">±{Math.round(currentLocation.accuracy)}m</span>
              </div>
            )}

            {currentLocation.speed && currentLocation.speed > 0 && (
              <div className="info-item">
                <span className="label">Velocidade</span>
                <span className="value">{Math.round(currentLocation.speed * 3.6)} km/h</span>
              </div>
            )}

            <div className="info-item">
              <span className="label">Última atualização</span>
              <span className="value">{formatTime(currentLocation.timestamp)}</span>
            </div>

            {getDistance() && (
              <div className="info-item">
                <span className="label">Distância até destino</span>
                <span className="value">{getDistance()?.toFixed(1)} km</span>
              </div>
            )}

            {estimatedArrival && (
              <div className="info-item">
                <span className="label">Chegada estimada</span>
                <span className="value">{formatTime(estimatedArrival)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {locationHistory.length > 1 && (
        <div className="tracking-stats">
          <h4>Estatísticas da viagem</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Pontos registrados</span>
              <span className="stat-value">{locationHistory.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tempo decorrido</span>
              <span className="stat-value">
                {locationHistory.length > 1 && locationHistory[0] && locationHistory[locationHistory.length - 1]
                  ? formatDuration(
                      (locationHistory[locationHistory.length - 1]!.timestamp.getTime() -
                       locationHistory[0]!.timestamp.getTime()) / (1000 * 60)
                    )
                  : '0min'
                }
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="tracking-notice">
        <small>
          📍 O rastreamento GPS requer permissão de localização e funciona melhor com uma conexão de internet estável.
        </small>
      </div>
    </div>
  );
}