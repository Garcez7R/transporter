import { useState } from 'react';
import type { AccessRole } from '../types';

type SettingsProps = {
  userRole: AccessRole;
  onExportData: (format: 'json' | 'csv') => void;
  onImportData: (file: File) => void;
  onClearCache: () => void;
  onResetSettings: () => void;
};

export function Settings({ userRole, onExportData, onImportData, onClearCache, onResetSettings }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'security' | 'advanced'>('general');

  const canAccessAdvanced = userRole === 'administrador' || userRole === 'gerente';

  return (
    <div className="settings-panel">
      <div className="section-head">
        <p className="eyebrow">Configurações</p>
        <h2>Preferências do Sistema</h2>
      </div>

      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          ⚙️ Geral
        </button>
        <button
          className={`tab-button ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          💾 Dados
        </button>
        {canAccessAdvanced && (
          <>
            <button
              className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              🔒 Segurança
            </button>
            <button
              className={`tab-button ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              🔧 Avançado
            </button>
          </>
        )}
      </div>

      <div className="settings-content">
        {activeTab === 'general' && (
          <div className="settings-section">
            <h3>Preferências Gerais</h3>
            <div className="setting-group">
              <label className="setting-item">
                <span>Notificações push</span>
                <input type="checkbox" defaultChecked />
              </label>
              <label className="setting-item">
                <span>Notificações sonoras</span>
                <input type="checkbox" defaultChecked />
              </label>
              <label className="setting-item">
                <span>Tema escuro</span>
                <input type="checkbox" />
              </label>
              <label className="setting-item">
                <span>Fonte grande (pacientes)</span>
                <input type="checkbox" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="settings-section">
            <h3>Gerenciamento de Dados</h3>
            <div className="setting-group">
              <div className="setting-item">
                <span>Exportar dados</span>
                <div className="setting-actions">
                  <button className="cta ghost" onClick={() => onExportData('json')}>
                    📄 JSON
                  </button>
                  <button className="cta ghost" onClick={() => onExportData('csv')}>
                    📊 CSV
                  </button>
                </div>
              </div>
              <div className="setting-item">
                <span>Importar dados</span>
                <label className="file-input">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportData(file);
                    }}
                  />
                  📁 Selecionar arquivo
                </label>
              </div>
              <div className="setting-item">
                <span>Limpar cache local</span>
                <button className="cta ghost warning" onClick={onClearCache}>
                  🗑️ Limpar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && canAccessAdvanced && (
          <div className="settings-section">
            <h3>Configurações de Segurança</h3>
            <div className="setting-group">
              <label className="setting-item">
                <span>Exigir PIN forte</span>
                <input type="checkbox" defaultChecked />
              </label>
              <label className="setting-item">
                <span>Bloqueio automático</span>
                <select defaultValue="30">
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="never">Nunca</option>
                </select>
              </label>
              <label className="setting-item">
                <span>Log de auditoria</span>
                <input type="checkbox" defaultChecked />
              </label>
              <div className="setting-item">
                <span>Último backup</span>
                <span className="setting-value">2024-01-15 14:30</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && canAccessAdvanced && (
          <div className="settings-section">
            <h3>Configurações Avançadas</h3>
            <div className="setting-group">
              <label className="setting-item">
                <span>Modo desenvolvedor</span>
                <input type="checkbox" />
              </label>
              <label className="setting-item">
                <span>Logs detalhados</span>
                <input type="checkbox" />
              </label>
              <div className="setting-item">
                <span>Resetar configurações</span>
                <button className="cta danger" onClick={onResetSettings}>
                  🔄 Resetar
                </button>
              </div>
              <div className="setting-info">
                <p><strong>⚠️ Aviso:</strong> As configurações avançadas devem ser alteradas apenas por administradores experientes.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}