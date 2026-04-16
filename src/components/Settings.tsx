import { useState } from 'react';
import type { AccessRole } from '../types';

type SettingsProps = {
  userRole: AccessRole;
  themeMode: 'dark' | 'light';
  patientFontLarge: boolean;
  pushStatus: 'supported' | 'unsupported' | 'granted' | 'denied' | 'default';
  onToggleTheme: () => void;
  onTogglePatientFont: () => void;
  onRequestPushPermission: () => void;
  onExportData: (format: 'json' | 'csv') => void;
  onClearCache: () => void;
  onResetSettings: () => void;
};

export function Settings({
  userRole,
  themeMode,
  patientFontLarge,
  pushStatus,
  onToggleTheme,
  onTogglePatientFont,
  onRequestPushPermission,
  onExportData,
  onClearCache,
  onResetSettings
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'security'>('general');
  const canAccessAdvanced = userRole === 'administrador' || userRole === 'gerente';

  return (
    <div className="settings-panel">
      <div className="section-head">
        <p className="eyebrow">Configurações</p>
        <h2>Preferências operacionais</h2>
      </div>

      <div className="settings-tabs">
        <button className={`tab-button ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
          Geral
        </button>
        <button className={`tab-button ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
          Dados
        </button>
        <button className={`tab-button ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
          Segurança
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'general' ? (
          <div className="settings-section">
            <h3>Preferências reais do app</h3>
            <div className="setting-group">
              <div className="setting-item">
                <span>Tema da interface</span>
                <button className="cta ghost" type="button" onClick={onToggleTheme}>
                  {themeMode === 'dark' ? 'Usando escuro · alternar' : 'Usando claro · alternar'}
                </button>
              </div>
              <div className="setting-item">
                <span>Fonte ampliada</span>
                <button className="cta ghost" type="button" onClick={onTogglePatientFont}>
                  {patientFontLarge ? 'Ativa · reduzir' : 'Normal · ampliar'}
                </button>
              </div>
              <div className="setting-item">
                <span>Permissão de notificações</span>
                <div className="setting-actions">
                  <span className="setting-value">
                    {pushStatus === 'granted'
                      ? 'Ativada'
                      : pushStatus === 'denied'
                      ? 'Bloqueada'
                      : pushStatus === 'unsupported'
                      ? 'Indisponível'
                      : 'Pendente'}
                  </span>
                  {pushStatus !== 'granted' && pushStatus !== 'unsupported' ? (
                    <button className="cta ghost" type="button" onClick={onRequestPushPermission}>
                      Solicitar acesso
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'data' ? (
          <div className="settings-section">
            <h3>Exportação operacional</h3>
            <div className="setting-group">
              <div className="setting-item">
                <span>Exportar snapshot do app</span>
                <div className="setting-actions">
                  <button className="cta ghost" type="button" onClick={() => onExportData('json')}>
                    JSON
                  </button>
                  <button className="cta ghost" type="button" onClick={() => onExportData('csv')}>
                    CSV
                  </button>
                </div>
              </div>
              <div className="setting-item">
                <span>Cache local</span>
                <button className="cta ghost warning" type="button" onClick={onClearCache}>
                  Limpar cache
                </button>
              </div>
              <div className="setting-info">
                <p><strong>Nota:</strong> importação em massa ficou temporariamente oculta até fecharmos validação, deduplicação e auditoria de dados.</p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <div className="settings-section">
            <h3>Segurança e governança</h3>
            <div className="setting-group">
              <div className="setting-item">
                <span>Perfil em sessão</span>
                <span className="setting-value">{userRole}</span>
              </div>
              <div className="setting-item">
                <span>Push Web</span>
                <span className="setting-value">{pushStatus}</span>
              </div>
              <div className="setting-item">
                <span>Auditoria local</span>
                <span className="setting-value">Eventos de UI e mudanças críticas seguem ativos</span>
              </div>
              {canAccessAdvanced ? (
                <div className="setting-item">
                  <span>Resetar preferências locais</span>
                  <button className="cta danger" type="button" onClick={onResetSettings}>
                    Resetar
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
