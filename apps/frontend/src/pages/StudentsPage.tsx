import React from 'react';

const StudentsPage: React.FC = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Uczniowie</h1>
        <p className="mt-2 text-gray-600">Zarządzaj uczniami swojej szkoły</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            placeholder="Szukaj ucznia..."
            className="px-4 py-2 border border-gray-300 rounded-lg w-64"
          />
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
            + Dodaj ucznia
          </button>
        </div>

        <p className="text-gray-500 text-center py-12">
          Lista uczniów - funkcja w przygotowaniu
        </p>
      </div>
    </div>
  );
};

export default StudentsPage;
