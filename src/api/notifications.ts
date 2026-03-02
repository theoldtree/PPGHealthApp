/**
 * Notifications API
 */
import {apiClient} from './client';
import type {Notification, NotificationType} from '../types/measurement';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export const getNotifications = async (): Promise<NotificationResponse[]> => {
  const response = await apiClient.get<NotificationResponse[]>(
    '/api/v1/notifications',
  );
  return response.data;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await apiClient.patch(`/api/v1/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await apiClient.post('/api/v1/notifications/mark-all-read');
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get<{count: number}>(
    '/api/v1/notifications/unread-count',
  );
  return response.data.count;
};

/** Map backend NotificationResponse to the app's Notification type */
export function toNotification(r: NotificationResponse): Notification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
    isRead: r.isRead,
    data: r.data,
  };
}
