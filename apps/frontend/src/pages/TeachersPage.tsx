import React from 'react';

const TeachersPage: React.FC = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Lektorzy</h1>
        <p className="mt-2 text-gray-600">Zarządzaj lektorami</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            placeholder="Szukaj lektora..."
            className="px-4 py-2 border border-gray-300 rounded-lg w-64"
          />
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            + Dodaj lektora
          </button>
        </div>

        <p className="text-gray-500 text-center py-12">
          Lista lektorów - funkcja w przygotowaniu
        </p>
      </div>
    </div>
  );
};

export default TeachersPage;
