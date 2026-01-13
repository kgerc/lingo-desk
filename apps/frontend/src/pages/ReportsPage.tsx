import React, { useState } from 'react';
import { DollarSign, UserPlus, TrendingUp, AlertCircle, Users } from 'lucide-react';
import TeacherPayoutsReport from '../components/reports/TeacherPayoutsReport';
import NewStudentsReport from '../components/reports/NewStudentsReport';
import MarginsReport from '../components/reports/MarginsReport';
import DebtorsReport from '../components/reports/DebtorsReport';
import RetentionReport from '../components/reports/RetentionReport';

type ReportType = 'teacher-payouts' | 'new-students' | 'margins' | 'debtors' | 'retention';

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportType>('teacher-payouts');

  const tabs = [
    {
      id: 'teacher-payouts' as ReportType,
      name: 'Wypłaty dla nauczycieli',
      icon: DollarSign,
    },
    {
      id: 'new-students' as ReportType,
      name: 'Nowi uczniowie',
      icon: UserPlus,
    },
    {
      id: 'margins' as ReportType,
      name: 'Marże',
      icon: TrendingUp,
    },
    {
      id: 'debtors' as ReportType,
      name: 'Dłużnicy',
      icon: AlertCircle,
    },
    {
      id: 'retention' as ReportType,
      name: 'Retencja i Churn',
      icon: Users,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Raporty</h1>
        <p className="mt-2 text-sm text-gray-600">
          Generuj raporty i eksportuj dane do CSV lub PDF
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-secondary text-secondary'
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

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'teacher-payouts' && <TeacherPayoutsReport />}
        {activeTab === 'new-students' && <NewStudentsReport />}
        {activeTab === 'margins' && <MarginsReport />}
        {activeTab === 'debtors' && <DebtorsReport />}
        {activeTab === 'retention' && <RetentionReport />}
      </div>
    </div>
  );
};

export default ReportsPage;
