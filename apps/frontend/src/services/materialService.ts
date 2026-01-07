import api from '../lib/api';

export interface Material {
  id: string;
  courseId: string;
  fileId: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  file: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    publicUrl: string;
    uploader: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    createdAt: string;
  };
  course?: {
    id: string;
    name: string;
  };
}

export interface CreateMaterialData {
  courseId: string;
  fileId: string;
  title: string;
  description?: string;
  orderIndex: number;
}

export interface UpdateMaterialData {
  title?: string;
  description?: string;
  orderIndex?: number;
}

const materialService = {
  async getMaterialsByCourse(courseId: string): Promise<Material[]> {
    const response = await api.get(`/materials/course/${courseId}`);
    return response.data.data;
  },

  async getMaterialById(id: string): Promise<Material> {
    const response = await api.get(`/materials/${id}`);
    return response.data.data;
  },

  async createMaterial(data: CreateMaterialData): Promise<Material> {
    const response = await api.post('/materials', data);
    return response.data.data;
  },

  async updateMaterial(id: string, data: UpdateMaterialData): Promise<Material> {
    const response = await api.put(`/materials/${id}`, data);
    return response.data.data;
  },

  async deleteMaterial(id: string): Promise<void> {
    await api.delete(`/materials/${id}`);
  },

  async reorderMaterials(courseId: string, materialIds: string[]): Promise<void> {
    await api.post(`/materials/course/${courseId}/reorder`, { materialIds });
  },
};

export default materialService;
