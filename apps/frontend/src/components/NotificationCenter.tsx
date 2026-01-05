import { Check, CheckCheck, Clock, Mail, AlertCircle } from 'lucide-react';
import { Notification } from '../services/notificationService';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

interface NotificationCenterProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export default function NotificationCenter({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return <Mail className="w-4 h-4" />;
      case 'ALERT':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'EMAIL':
        return 'text-blue-500 bg-blue-50';
      case 'ALERT':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Powiadomienia</h3>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-sm text-secondary hover:text-secondary-dark flex items-center gap-1"
            >
              <CheckCheck className="w-4 h-4" />
              Oznacz wszystkie jako przeczytane
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-sm text-gray-600">
            Masz {unreadCount} {unreadCount === 1 ? 'nieprzeczytane powiadomienie' : 'nieprzeczytanych powiadomień'}
          </p>
        )}
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-secondary rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-600">Ładowanie powiadomień...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-3">
              <Check className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Brak nowych powiadomień</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !notification.readAt ? 'bg-blue-50' : ''
                }`}
                onClick={() => !notification.readAt && onMarkAsRead(notification.id)}
              >
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getNotificationColor(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!notification.readAt ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </p>
                      {!notification.readAt && (
                        <div className="flex-shrink-0 w-2 h-2 bg-secondary rounded-full mt-1.5"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            Pokazano {notifications.length} ostatnich powiadomień
          </p>
        </div>
      )}
    </div>
  );
}
