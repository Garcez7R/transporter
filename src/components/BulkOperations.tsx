import { useState } from 'react';
import type { TripRequest } from '../types';

type BulkOperationsProps = {
  selectedRequests: string[];
  requests: TripRequest[];
  onBulkUpdate: (ids: string[], status: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onExport: (format: 'csv' | 'json' | 'pdf') => void;
  onImport: (file: File) => void;
};

export function BulkOperations({
  selectedRequests,
  requests,
  onBulkUpdate,
  onBulkDelete,
  onExport,
  onImport
}: BulkOperationsProps) {
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  if (selectedRequests.length === 0) return null;

  const selectedData = requests.filter(r => selectedRequests.includes(r.id));

  return (
    <div className="bulk-operations glass-card">
      <div className="bulk-header">
        <span className="bulk-count">
          {selectedRequests.length} solicitaç{selectedRequests.length > 1 ? 'ões' : 'ão'} selecionada{selectedRequests.length > 1 ? 's' : ''}
        </span>
        <div className="bulk-actions">
          <button
            className="cta ghost"
            onClick={() => setShowBulkMenu(!showBulkMenu)}
          >
            ⚡ Ações em Lote
          </button>
          <button
            className="cta ghost"
            onClick={() => onExport('csv')}
          >
            📤 Exportar
          </button>
        </div>
      </div>

      {showBulkMenu && (
        <div className="bulk-menu">
          <div className="bulk-section">
            <h4>Alterar Status</h4>
            <div className="bulk-buttons">
              <button
                className="cta ghost"
                onClick={() => onBulkUpdate(selectedRequests, 'agendada')}
              >
                📅 Agendar
              </button>
              <button
                className="cta ghost"
                onClick={() => onBulkUpdate(selectedRequests, 'em_rota')}
              >
                🚗 Em Rota
              </button>
              <button
                className="cta ghost"
                onClick={() => onBulkUpdate(selectedRequests, 'concluida')}
              >
                ✅ Concluir
              </button>
              <button
                className="cta ghost"
                onClick={() => onBulkUpdate(selectedRequests, 'cancelada')}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>

          <div className="bulk-section">
            <h4>Outras Ações</h4>
            <div className="bulk-buttons">
              <button
                className="cta ghost"
                onClick={() => onBulkDelete(selectedRequests)}
              >
                🗑️ Excluir
              </button>
              <button
                className="cta ghost"
                onClick={() => onExport('pdf')}
              >
                📄 Relatório PDF
              </button>
            </div>
          </div>

          <div className="bulk-section">
            <h4>Importar/Exportar</h4>
            <div className="bulk-buttons">
              <button
                className="cta ghost"
                onClick={() => onExport('json')}
              >
                💾 Exportar JSON
              </button>
              <label className="cta ghost file-input">
                📁 Importar
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport(file);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="bulk-summary">
        <div className="summary-item">
          <span>Status atual:</span>
          <div className="status-badges">
            {Object.entries(
              selectedData.reduce((acc, req) => {
                acc[req.status] = (acc[req.status] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([status, count]) => (
              <span key={status} className={`status status-${status}`}>
                {status.replace('_', ' ')} ({count})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}