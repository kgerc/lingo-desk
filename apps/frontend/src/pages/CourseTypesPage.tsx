import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseTypeService, CourseType } from '../services/courseTypeService';
import CourseTypeModal from '../components/CourseTypeModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const CourseTypesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourseType, setSelectedCourseType] = useState<CourseType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: courseTypes = [], isLoading } = useQuery({
    queryKey: ['courseTypes'],
    queryFn: courseTypeService.getCourseTypes,
  });

  const deleteMutation = useMutation({
    mutationFn: courseTypeService.deleteCourseType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseTypes'] });
      toast.success('Typ kursu został usunięty');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania typu kursu');
    },
  });

  const handleEdit = (courseType: CourseType) => {
    setSelectedCourseType(courseType);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCourseType(null);
  };

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['courseTypes'] });
    handleModalClose();
  };

  const getLanguageLabel = (code: string) => {
    const languages: Record<string, string> = {
      en: 'Angielski',
      de: 'Niemiecki',
      es: 'Hiszpański',
      fr: 'Francuski',
      it: 'Włoski',
      pl: 'Polski',
    };
    return languages[code] || code;
  };

  const getFormatLabel = (format: string) => {
    const formats: Record<string, string> = {
      INDIVIDUAL: 'Indywidualne',
      GROUP: 'Grupowe',
      HYBRID: 'Hybrydowe',
    };
    return formats[format] || format;
  };

  const getDeliveryModeLabel = (mode: string) => {
    const modes: Record<string, string> = {
      IN_PERSON: 'Stacjonarne',
      ONLINE: 'Online',
      BOTH: 'Stacjonarne i Online',
    };
    return modes[mode] || mode;
  };

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner message="Ładowanie typów kursów..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Typy kursów</h1>
              <p className="text-gray-600 mt-2">
                Zarządzaj szablonami typów kursów w systemie
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" />
              Dodaj typ kursu
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Wszystkie typy</p>
                <p className="text-2xl font-bold text-gray-900">{courseTypes.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Indywidualne</p>
                <p className="text-2xl font-bold text-gray-900">
                  {courseTypes.filter((ct) => ct.format === 'INDIVIDUAL').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Grupowe</p>
                <p className="text-2xl font-bold text-gray-900">
                  {courseTypes.filter((ct) => ct.format === 'GROUP').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Course Types List */}
        {courseTypes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Brak typów kursów</h3>
            <p className="text-gray-600 mb-6">
              Rozpocznij od utworzenia pierwszego typu kursu
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Plus className="h-5 w-5" />
              Dodaj typ kursu
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nazwa
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Język
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Poziom
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Format
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Prowadzenie
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Czas trwania
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cena
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {courseTypes.map((courseType) => (
                    <tr
                      key={courseType.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {courseType.name}
                          </div>
                          {courseType.description && (
                            <div className="text-sm text-gray-500 mt-1">
                              {courseType.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {getLanguageLabel(courseType.language)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {courseType.level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {getFormatLabel(courseType.format)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {getDeliveryModeLabel(courseType.deliveryMode)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {courseType.defaultDurationMinutes} min
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {courseType.pricePerLesson} PLN
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(courseType)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edytuj"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {deleteConfirm === courseType.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">Potwierdź:</span>
                              <button
                                onClick={() => handleDelete(courseType.id)}
                                disabled={deleteMutation.isPending}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                Usuń
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                              >
                                Anuluj
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(courseType.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Usuń"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Modal */}
      {isModalOpen && (
        <CourseTypeModal
          courseType={selectedCourseType}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default CourseTypesPage;
