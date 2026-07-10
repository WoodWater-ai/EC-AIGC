/**
 * 通知管理 API —— 对接后端 AdminNotificationController
 *
 * 后端路径：/v1/admin/notification/*
 * 鉴权：类级 @SaCheckLogin
 */
import http from '../client';
import type { NotificationResponse, PageInfo } from '../types';

/** 我的通知分页 */
export async function myPage(req: {
  pageNum: number;
  pageSize: number;
}): Promise<PageInfo<NotificationResponse>> {
  return http.post<PageInfo<NotificationResponse>>('/v1/admin/notification/my-page', req);
}

/** 标记单条已读 */
export async function markRead(id: number): Promise<void> {
  return http.post<void>('/v1/admin/notification/mark-read', { id });
}

/** 全部已读 */
export async function markAllRead(): Promise<void> {
  return http.post<void>('/v1/admin/notification/mark-all-read');
}

/** 未读数 */
export async function unreadCount(): Promise<number> {
  return http.post<number>('/v1/admin/notification/unread-count');
}

export const notificationApi = { myPage, markRead, markAllRead, unreadCount };
