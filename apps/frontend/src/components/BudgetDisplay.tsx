import React from 'react';

interface BudgetDisplayProps {
  hoursPurchased: number;
  hoursUsed: number;
  hoursRemaining: number;
  lowBudget: boolean;
}

const BudgetDisplay: React.FC<BudgetDisplayProps> = ({
  hoursPurchased,
  hoursUsed,
  hoursRemaining,
  lowBudget,
}) => {
  const percentageUsed = (hoursUsed / hoursPurchased) * 100;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Budget godzinowy</h3>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Wykorzystano: {hoursUsed.toFixed(2)}h</span>
          <span>Pozostało: {hoursRemaining.toFixed(2)}h</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              lowBudget ? 'bg-red-600' : percentageUsed > 80 ? 'bg-yellow-500' : 'bg-green-600'
            }`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500">Zakupione</div>
          <div className="text-lg font-semibold text-gray-900">{hoursPurchased.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Wykorzystane</div>
          <div className="text-lg font-semibold text-blue-600">{hoursUsed.toFixed(1)}h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Pozostałe</div>
          <div className={`text-lg font-semibold ${lowBudget ? 'text-red-600' : 'text-green-600'}`}>
            {hoursRemaining.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Warning */}
      {lowBudget && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
          <p className="text-xs text-red-700 font-medium">
            ⚠️ Niski stan konta! Pozostało mniej niż 2 godziny.
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetDisplay;
