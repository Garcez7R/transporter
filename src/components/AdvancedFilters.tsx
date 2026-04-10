import { useState, useMemo } from 'react';
import type { RequestStatus } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

type AdvancedFiltersProps = {
  onFiltersChange: (filters: {
    dateRange: { start: Date | null; end: Date | null };
    statuses: RequestStatus[];
    location: string;
    driver: string;
    vehicle: string;
  }) => void;
  availableDrivers: string[];
  availableVehicles: string[];
};

export function AdvancedFilters({ onFiltersChange, availableDrivers, availableVehicles }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<RequestStatus[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');

  const statusOptions: { value: RequestStatus; label: string }[] = [
    { value: 'rascunho', label: 'Rascunho' },
    { value: 'em_atendimento', label: 'Em atendimento' },
    { value: 'aguardando_distribuicao', label: 'Aguardando distribuição' },
    { value: 'agendada', label: 'Agendada' },
    { value: 'em_rota', label: 'Em rota' },
    { value: 'concluida', label: 'Concluída' },
    { value: 'cancelada', label: 'Cancelada' }
  ];

  const dateRanges = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : null,
          end: customEndDate ? new Date(customEndDate) : null
        };
      default:
        return { start: null, end: null };
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const handleStatusToggle = (status: RequestStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleApplyFilters = () => {
    onFiltersChange({
      dateRange: dateRanges,
      statuses: selectedStatuses,
      location: locationFilter,
      driver: driverFilter,
      vehicle: vehicleFilter
    });
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedStatuses([]);
    setLocationFilter('');
    setDriverFilter('');
    setVehicleFilter('');
    onFiltersChange({
      dateRange: { start: null, end: null },
      statuses: [],
      location: '',
      driver: '',
      vehicle: ''
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFilter !== 'all') count++;
    if (selectedStatuses.length > 0) count++;
    if (locationFilter) count++;
    if (driverFilter) count++;
    if (vehicleFilter) count++;
    return count;
  }, [dateFilter, selectedStatuses, locationFilter, driverFilter, vehicleFilter]);

  return (
    <div className="advanced-filters">
      <button
        className={`cta ghost filter-toggle ${activeFiltersCount > 0 ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Filtros avançados ${activeFiltersCount > 0 ? `(${activeFiltersCount} ativo${activeFiltersCount > 1 ? 's' : ''})` : ''}`}
      >
        <span>🔍 Filtros avançados</span>
        {activeFiltersCount > 0 && <span className="filter-badge">{activeFiltersCount}</span>}
      </button>

      {isOpen && (
        <div className="filter-panel glass-card">
          <div className="filter-header">
            <h3>Filtros avançados</h3>
            <button className="close-button" onClick={() => setIsOpen(false)} aria-label="Fechar filtros">
              ✕
            </button>
          </div>

          <div className="filter-sections">
            {/* Filtro por Data */}
            <div className="filter-section">
              <h4>Data</h4>
              <div className="date-presets">
                {[
                  { value: 'all', label: 'Todas as datas' },
                  { value: 'today', label: 'Hoje' },
                  { value: 'yesterday', label: 'Ontem' },
                  { value: 'week', label: 'Esta semana' },
                  { value: 'month', label: 'Este mês' },
                  { value: 'custom', label: 'Período personalizado' }
                ].map(preset => (
                  <label key={preset.value} className="radio-option">
                    <input
                      type="radio"
                      name="dateFilter"
                      value={preset.value}
                      checked={dateFilter === preset.value}
                      onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    />
                    <span>{preset.label}</span>
                  </label>
                ))}
              </div>

              {dateFilter === 'custom' && (
                <div className="custom-date-range">
                  <div className="input-group">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      placeholder="Data inicial"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      placeholder="Data final"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Filtro por Status */}
            <div className="filter-section">
              <h4>Status</h4>
              <div className="status-checkboxes">
                {statusOptions.map(status => (
                  <label key={status.value} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status.value)}
                      onChange={() => handleStatusToggle(status.value)}
                    />
                    <span className={`status status-${status.value}`}>{status.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtro por Localização */}
            <div className="filter-section">
              <h4>Localização</h4>
              <input
                type="text"
                placeholder="Cidade, bairro ou CEP..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>

            {/* Filtro por Motorista */}
            <div className="filter-section">
              <h4>Motorista</h4>
              <input
                type="text"
                placeholder="Nome do motorista..."
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                list="drivers-list"
              />
              <datalist id="drivers-list">
                {availableDrivers.map(driver => (
                  <option key={driver} value={driver} />
                ))}
              </datalist>
            </div>

            {/* Filtro por Veículo */}
            <div className="filter-section">
              <h4>Veículo</h4>
              <input
                type="text"
                placeholder="Placa ou modelo..."
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                list="vehicles-list"
              />
              <datalist id="vehicles-list">
                {availableVehicles.map(vehicle => (
                  <option key={vehicle} value={vehicle} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="filter-actions">
            <button className="cta ghost" onClick={handleClearFilters}>
              Limpar filtros
            </button>
            <button className="cta" onClick={handleApplyFilters}>
              Aplicar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}