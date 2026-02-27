import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import classroomService, { Classroom, Location } from '../services/classroomService';
import { Building2, MapPin, Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

// ─── Modals ──────────────────────────────────────────────────────────────────

interface LocationModalProps {
  location: Location | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ location, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const isEdit = !!location;
  const [name, setName] = useState(location?.name || '');
  const [address, setAddress] = useState(location?.address || '');

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? classroomService.updateLocation(location!.id, { name, address })
        : classroomService.createLocation({ name, address }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success(isEdit ? 'Lokalizacja zaktualizowana' : 'Lokalizacja dodana');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Błąd podczas zapisywania');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edytuj lokalizację' : 'Dodaj lokalizację'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="np. Centrum językowe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="np. ul. Przykładowa 1, Warszawa"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {mutation.isPending ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : 'Dodaj'}
              </button>
            </div>
          </form>
        </div>
    </div>,
    document.body
  );
};

interface ClassroomModalProps {
  classroom: Classroom | null;
  locations: Location[];
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ClassroomModal: React.FC<ClassroomModalProps> = ({
  classroom,
  locations,
  defaultLocationId,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEdit = !!classroom;
  const [name, setName] = useState(classroom?.name || '');
  const [capacity, setCapacity] = useState(classroom?.capacity?.toString() || '');
  const [locationId, setLocationId] = useState(classroom?.locationId || defaultLocationId || '');

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? classroomService.updateClassroom(classroom!.id, {
            name,
            capacity: capacity ? Number(capacity) : undefined,
            locationId,
          })
        : classroomService.createClassroom({ locationId, name, capacity: capacity ? Number(capacity) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success(isEdit ? 'Sala zaktualizowana' : 'Sala dodana');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Błąd podczas zapisywania');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !locationId) return;
    mutation.mutate();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edytuj salę' : 'Dodaj salę'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lokalizacja *</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">Wybierz lokalizację</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa sali *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="np. Sala A, Sala 101"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pojemność (opcjonalnie)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="np. 10"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim() || !locationId}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {mutation.isPending ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : 'Dodaj'}
              </button>
            </div>
          </form>
        </div>
    </div>,
    document.body
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ClassroomsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Modals
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [classroomModalOpen, setClassroomModalOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | undefined>();

  // Confirm dialogs
  const [confirmLocation, setConfirmLocation] = useState<Location | null>(null);
  const [confirmClassroom, setConfirmClassroom] = useState<Classroom | null>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => classroomService.getLocations(),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id: string) => classroomService.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Lokalizacja usunięta');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Błąd podczas usuwania');
    },
  });

  const deleteClassroomMutation = useMutation({
    mutationFn: (id: string) => classroomService.deleteClassroom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Sala usunięta');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Błąd podczas usuwania');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      classroomService.updateClassroom(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Błąd');
    },
  });

  const toggleLocationExpanded = (id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddClassroom = (locationId: string) => {
    setEditingClassroom(null);
    setDefaultLocationId(locationId);
    setClassroomModalOpen(true);
  };

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setDefaultLocationId(undefined);
    setClassroomModalOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocationModalOpen(true);
  };

  const handleAddLocation = () => {
    setEditingLocation(null);
    setLocationModalOpen(true);
  };

  const handleDeleteLocation = (location: Location) => {
    setConfirmLocation(location);
  };

  const handleDeleteClassroom = (classroom: Classroom) => {
    setConfirmClassroom(classroom);
  };

  const totalClassrooms = locations.reduce((sum, loc) => sum + (loc.classrooms?.length || 0), 0);

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner message="Ładowanie sal..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sale i lokalizacje</h1>
          <p className="mt-2 text-gray-600">
            {locations.length} {locations.length === 1 ? 'lokalizacja' : 'lokalizacji'},{' '}
            {totalClassrooms} {totalClassrooms === 1 ? 'sala' : 'sal'}
          </p>
        </div>
        <button
          onClick={handleAddLocation}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Dodaj lokalizację
        </button>
      </div>

      {/* Locations list */}
      {locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak lokalizacji</h3>
          <p className="text-gray-500 mb-6">Dodaj pierwszą lokalizację, aby zarządzać salami.</p>
          <button
            onClick={handleAddLocation}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Dodaj lokalizację
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map((location) => {
            const isExpanded = expandedLocations.has(location.id);
            const classrooms = location.classrooms || [];

            return (
              <div key={location.id} className="bg-white rounded-lg shadow border border-gray-200">
                {/* Location header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleLocationExpanded(location.id)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      className="text-gray-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLocationExpanded(location.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>
                    <Building2 className="h-5 w-5 text-secondary" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{location.name}</h3>
                      {location.address && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {location.address}
                        </p>
                      )}
                    </div>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {classrooms.length} {classrooms.length === 1 ? 'sala' : 'sal'}
                    </span>
                    {!location.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        Nieaktywna
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleAddClassroom(location.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Dodaj salę
                    </button>
                    <button
                      onClick={() => handleEditLocation(location)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edytuj lokalizację"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Usuń lokalizację"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Classrooms list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {classrooms.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        Brak sal w tej lokalizacji.{' '}
                        <button
                          onClick={() => handleAddClassroom(location.id)}
                          className="text-primary hover:underline"
                        >
                          Dodaj pierwszą salę
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {classrooms.map((classroom) => (
                          <div
                            key={classroom.id}
                            className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-secondary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{classroom.name}</p>
                                {classroom.capacity && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Pojemność: {classroom.capacity} osób
                                  </p>
                                )}
                              </div>
                              {!classroom.isActive && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Nieaktywna
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  toggleActive.mutate({ id: classroom.id, isActive: !classroom.isActive })
                                }
                                className={`p-2 rounded-lg transition-colors ${
                                  classroom.isActive
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-gray-400 hover:bg-gray-100'
                                }`}
                                title={classroom.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditClassroom(classroom)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edytuj salę"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClassroom(classroom)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Usuń salę"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {locationModalOpen && (
        <LocationModal
          location={editingLocation}
          onClose={() => setLocationModalOpen(false)}
          onSuccess={() => setLocationModalOpen(false)}
        />
      )}

      {classroomModalOpen && (
        <ClassroomModal
          classroom={editingClassroom}
          locations={locations}
          defaultLocationId={defaultLocationId}
          onClose={() => setClassroomModalOpen(false)}
          onSuccess={() => setClassroomModalOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmLocation}
        onClose={() => setConfirmLocation(null)}
        onConfirm={() => {
          if (confirmLocation) deleteLocationMutation.mutate(confirmLocation.id);
          setConfirmLocation(null);
        }}
        title="Usuń lokalizację"
        message={`Czy na pewno chcesz usunąć lokalizację "${confirmLocation?.name}"? Operacja jest nieodwracalna.`}
        confirmText="Usuń"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!confirmClassroom}
        onClose={() => setConfirmClassroom(null)}
        onConfirm={() => {
          if (confirmClassroom) deleteClassroomMutation.mutate(confirmClassroom.id);
          setConfirmClassroom(null);
        }}
        title="Usuń salę"
        message={`Czy na pewno chcesz usunąć salę "${confirmClassroom?.name}"? Operacja jest nieodwracalna.`}
        confirmText="Usuń"
        variant="danger"
      />
    </div>
  );
};

export default ClassroomsPage;
