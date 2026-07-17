import { useState, useEffect, useRef, useCallback } from 'react';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import { useNavigate } from 'react-router-dom';
import { api, type NotificationItem } from '../services/api';
import './NotificationCenter.css';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      const notifs = res.data || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Listen for external notification refresh events
    const refreshHandler = () => fetchNotifications();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshHandler);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshHandler);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    // Mark as read first (best-effort)
    if (!notif.isRead) {
      try {
        await api.markNotificationRead(notif.id);
        fetchNotifications();
      } catch (err) {
        console.error('Failed to mark as read', err);
      }
    }
    setIsOpen(false);
    const requestId = notif.requestId ?? notif.request?.id;
    if (requestId) {
      navigate(`/request/${requestId}`);
    }
  };

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button className="notification-bell" onClick={() => setIsOpen(!isOpen)} aria-label="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-read-btn" onClick={handleMarkAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-notifications">No notifications yet.</div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                  style={{ cursor: (notif.requestId ?? notif.request?.id) ? 'pointer' : 'default' }}
                >
                  <div className="notification-content">
                    <p>{notif.message}</p>
                    <span className="notification-time">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {!notif.isRead && <div className="unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
