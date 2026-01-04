import React from 'react';

const CalendarPage: React.FC = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Grafik zajęć</h1>
        <p className="mt-2 text-gray-600">Przeglądaj i planuj zajęcia</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-96 flex items-center justify-center">
        <p className="text-gray-500 text-center">
          Kalendarz - funkcja w przygotowaniu
        </p>
      </div>
    </div>
  );
};

export default CalendarPage;
