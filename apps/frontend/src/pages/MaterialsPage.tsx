import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/courseService';
import materialService, { Material } from '../services/materialService';
import { FileText, Search, FolderOpen, Download, Trash2, Plus } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import UploadMaterialModal from '../components/UploadMaterialModal';
import toast from 'react-hot-toast';

const MaterialsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; materialId: string | null }>({
    isOpen: false,
    materialId: null
  });

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ isActive: true }),
  });

  // Fetch materials for selected course
  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['materials', selectedCourseId],
    queryFn: () => materialService.getMaterialsByCourse(selectedCourseId),
    enabled: !!selectedCourseId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => materialService.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Materiał został pomyślnie usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania materiału');
    },
  });

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, materialId: id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.materialId) {
      await deleteMutation.mutateAsync(confirmDialog.materialId);
      setConfirmDialog({ isOpen: false, materialId: null });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredMaterials = materials.filter(material =>
    material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Materiały</h1>
        <p className="mt-2 text-gray-600">Zarządzaj materiałami do zajęć</p>
      </div>

      {/* Course Selector & Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Course Selector */}
        <div className="flex-1">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Wybierz kurs</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} - {course.courseType.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        {selectedCourseId && (
          <>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Szukaj materiałów..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              Dodaj materiał
            </button>
          </>
        )}
      </div>

      {/* Materials List */}
      {!selectedCourseId ? (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Wybierz kurs</h3>
          <p className="text-gray-600">
            Wybierz kurs z listy powyżej, aby zobaczyć materiały
          </p>
        </div>
      ) : isLoadingMaterials ? (
        <LoadingSpinner message="Ładowanie materiałów..." />
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Brak materiałów</h3>
          <p className="text-gray-600">
            {searchTerm
              ? 'Nie znaleziono materiałów pasujących do wyszukiwania'
              : 'Ten kurs nie ma jeszcze żadnych materiałów'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="divide-y divide-gray-200">
            {filteredMaterials.map((material) => (
              <div key={material.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* File Icon */}
                    <div className="text-4xl">{getFileIcon(material.file.fileType)}</div>

                    {/* Material Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {material.title}
                      </h3>
                      {material.description && (
                        <p className="text-sm text-gray-600 mb-2">{material.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {material.file.fileName}
                        </span>
                        <span>{formatFileSize(material.file.fileSize)}</span>
                        <span>
                          Dodano przez: {material.file.uploader.firstName} {material.file.uploader.lastName}
                        </span>
                        <span>
                          {new Date(material.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <a
                      href={material.file.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Pobierz"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                    <button
                      onClick={() => handleDelete(material.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Usuń"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {isUploadModalOpen && selectedCourseId && (
        <UploadMaterialModal
          courseId={selectedCourseId}
          courseName={courses.find(c => c.id === selectedCourseId)?.name || ''}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            setIsUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['materials'] });
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Usuń materiał"
        message="Czy na pewno chcesz usunąć ten materiał? Tej operacji nie można cofnąć."
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, materialId: null })}
        variant="danger"
      />
    </div>
  );
};

export default MaterialsPage;
