import type { BannerState, ToastState } from '../types';

type NotificationBannerProps = {
  banner: BannerState | null;
  toasts: ToastState[];
};

export function NotificationBanner({ banner }: Pick<NotificationBannerProps, 'banner'>) {
  if (!banner) return null;

  return (
    <section className={`glass-card banner banner-${banner.type}`}>
      <strong>{banner.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
      <p>{banner.message}</p>
    </section>
  );
}

export function ToastStack({ toasts }: Pick<NotificationBannerProps, 'toasts'>) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <strong>{toast.type === 'error' ? 'Erro' : 'Sucesso'}</strong>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
