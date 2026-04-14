import { useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { TripRequest } from '../types';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationOptions {
  duration?: number;
  sound?: boolean;
}

class NotificationManager {
  private static instance: NotificationManager;
  private audioContext: AudioContext | null = null;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async showBrowserNotification(title: string, options?: NotificationOptions & { body?: string; icon?: string; tag?: string }) {
    if (!(await this.requestPermission())) {
      return;
    }

    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/icon-192.png',
      tag: options?.tag,
      requireInteraction: false,
      silent: !options?.sound
    });

    if (options?.sound) {
      this.playNotificationSound();
    }

    // Auto-close after duration
    if (options?.duration) {
      setTimeout(() => notification.close(), options.duration);
    }

    return notification;
  }

  private async playNotificationSound() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  showToast(message: string, type: NotificationType = 'info', options?: NotificationOptions) {
    const toastOptions = {
      duration: options?.duration || 4000,
      style: {
        background: this.getBackgroundColor(type),
        color: '#fff',
        borderRadius: '8px',
        fontWeight: '500'
      }
    };

    switch (type) {
      case 'success':
        toast.success(message, toastOptions);
        break;
      case 'error':
        toast.error(message, toastOptions);
        break;
      case 'warning':
        toast(message, { ...toastOptions, icon: '⚠️' });
        break;
      default:
        toast(message, toastOptions);
    }

    if (options?.sound) {
      this.playNotificationSound();
    }
  }

  private getBackgroundColor(type: NotificationType): string {
    switch (type) {
      case 'success':
        return '#168553';
      case 'error':
        return '#b34343';
      case 'warning':
        return '#d4a417';
      default:
        return '#4fd7ff';
    }
  }
}

export const notificationManager = NotificationManager.getInstance();

export function useNotifications() {
  const showSuccess = useCallback((message: string, options?: NotificationOptions) => {
    notificationManager.showToast(message, 'success', options);
  }, []);

  const showError = useCallback((message: string, options?: NotificationOptions) => {
    notificationManager.showToast(message, 'error', options);
  }, []);

  const showWarning = useCallback((message: string, options?: NotificationOptions) => {
    notificationManager.showToast(message, 'warning', options);
  }, []);

  const showInfo = useCallback((message: string, options?: NotificationOptions) => {
    notificationManager.showToast(message, 'info', options);
  }, []);

  const showBrowserNotification = useCallback((title: string, options?: NotificationOptions & { body?: string; icon?: string; tag?: string }) => {
    notificationManager.showBrowserNotification(title, options);
  }, []);

  const requestPermission = useCallback(() => notificationManager.requestPermission(), []);

  // Auto-notifications for request status changes
  const notifyRequestStatusChange = useCallback((request: TripRequest, oldStatus?: string) => {
    const statusMessages = {
      agendada: 'Solicitação agendada com sucesso',
      em_rota: 'Viagem iniciada - motorista a caminho',
      concluida: 'Viagem concluída com sucesso',
      cancelada: 'Solicitação cancelada'
    };

    if (statusMessages[request.status as keyof typeof statusMessages]) {
      showSuccess(statusMessages[request.status as keyof typeof statusMessages], { sound: true });

      // Browser notification for important status changes
      if (['em_rota', 'concluida', 'cancelada'].includes(request.status)) {
        showBrowserNotification(
          `Viagem ${request.protocol}`,
          {
            body: statusMessages[request.status as keyof typeof statusMessages],
            sound: true,
            tag: `request-${request.id}`
          }
        );
      }
    }
  }, [showSuccess, showBrowserNotification]);

  const notifyNewRequest = useCallback((request: TripRequest) => {
    showInfo(`Nova solicitação recebida: ${request.protocol}`, { sound: true });
    showBrowserNotification(
      'Nova solicitação',
      {
        body: `${request.clientName} - ${request.destination}`,
        sound: true,
        tag: 'new-request'
      }
    );
  }, [showInfo, showBrowserNotification]);

  const notifyUrgentRequest = useCallback((request: TripRequest) => {
    showWarning(`Solicitação urgente: ${request.protocol}`, { sound: true });
    showBrowserNotification(
      '🚨 Solicitação Urgente',
      {
        body: `${request.clientName} - ${request.destination}`,
        sound: true,
        tag: `urgent-${request.id}`
      }
    );
  }, [showWarning, showBrowserNotification]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showBrowserNotification,
    requestPermission,
    notifyRequestStatusChange,
    notifyNewRequest,
    notifyUrgentRequest
  };
}
