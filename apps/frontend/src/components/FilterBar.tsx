import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  placeholder?: string;
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2 | 3;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onClearAll?: () => void;
  filterCols?: 2 | 3 | 4 | 5 | 6;
}

const colsClass: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
};

const colSpanClass: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
};

export default function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Szukaj...',
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearAll,
  filterCols = 3,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Propagate debounced search up
  React.useEffect(() => {
    onSearchChange(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Sync external value to local (e.g. when cleared externally)
  React.useEffect(() => {
    if (searchValue !== localSearch) {
      setLocalSearch(searchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const activeFiltersCount = filters.filter((f) => filterValues[f.key]).length;
  const hasActiveFilters = activeFiltersCount > 0 || !!localSearch;

  function handleClearAll() {
    setLocalSearch('');
    onClearAll?.();
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-6">
      <div className="flex gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>

        {/* Filters toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || activeFiltersCount > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtry
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}

        {/* Clear all */}
        {hasActiveFilters && onClearAll && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Wyczyść filtry"
          >
            <X className="h-4 w-4" />
            Wyczyść
          </button>
        )}
      </div>

      {/* Filter fields panel */}
      {showFilters && filters.length > 0 && (
        <div className={`mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 ${colsClass[filterCols]} gap-3`}>
          {filters.map((field) => (
            <div key={field.key} className={field.colSpan ? colSpanClass[field.colSpan] : undefined}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={filterValues[field.key] ?? ''}
                  onChange={(e) => onFilterChange?.(field.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Wszystkie</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={filterValues[field.key] ?? ''}
                  onChange={(e) => onFilterChange?.(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
