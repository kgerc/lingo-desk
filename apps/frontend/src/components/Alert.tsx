import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from 'lucide-react';

export type AlertVariant = 'error' | 'warning' | 'info' | 'success';

interface AlertProps {
  variant: AlertVariant;
  title: string;
  message: string;
  onDismiss?: () => void;
  dismissible?: boolean;
}

const Alert: React.FC<AlertProps> = ({ variant, title, message, onDismiss, dismissible = false }) => {
  const variantStyles = {
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      title: 'text-red-900',
      message: 'text-red-700',
      Icon: AlertCircle,
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-900',
      message: 'text-yellow-700',
      Icon: AlertTriangle,
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-900',
      message: 'text-blue-700',
      Icon: Info,
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      title: 'text-green-900',
      message: 'text-green-700',
      Icon: CheckCircle,
    },
  };

  const style = variantStyles[variant];
  const IconComponent = style.Icon;

  return (
    <div className={`border rounded-lg p-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${style.title}`}>{title}</h3>
          <p className={`text-sm mt-1 ${style.message}`}>{message}</p>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 ${style.icon} hover:opacity-70 transition-opacity`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
