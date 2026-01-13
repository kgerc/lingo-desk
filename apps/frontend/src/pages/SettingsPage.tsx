import React, { useState } from 'react';
import { Building2, Bell, Mail, Plug } from 'lucide-react';
import OrganizationSettingsPage from './OrganizationSettingsPage';
import NotificationSettingsPage from './NotificationSettingsPage';
import MailingsPage from './MailingsPage';
import IntegrationsPage from './IntegrationsPage';

type TabType = 'organization' | 'notifications' | 'mailings' | 'integrations';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('organization');

  const tabs = [
    {
      id: 'organization' as TabType,
      name: 'Organizacja',
      icon: Building2,
    },
    {
      id: 'notifications' as TabType,
      name: 'Powiadomienia',
      icon: Bell,
    },
    {
      id: 'mailings' as TabType,
      name: 'Mailingi',
      icon: Mail,
    },
    {
      id: 'integrations' as TabType,
      name: 'Integracje',
      icon: Plug,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tabs Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Ustawienia</h1>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'organization' && <OrganizationSettingsPage />}
        {activeTab === 'notifications' && <NotificationSettingsPage />}
        {activeTab === 'mailings' && <MailingsPage />}
        {activeTab === 'integrations' && <IntegrationsPage />}
      </div>
    </div>
  );
};

export default SettingsPage;
