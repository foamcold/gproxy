import apiClient from '@/utils/api';

export interface PresetItem {
    id?: string;
    role: 'system' | 'user' | 'assistant';
    type: 'normal' | 'user_input' | 'history';
    name: string;
    content: string;
    order: number;
}

export interface PresetContent {
    items: PresetItem[];
}

export interface Preset {
    id: number;
    name: string;
    content: string; // JSON string of PresetContent
    is_active: boolean;
    sort_order: number;
    created_at?: string;
}

export interface PresetCreate {
    name: string;
    content: string;
    is_active: boolean;
    sort_order: number;
}

export interface PresetUpdate extends PresetCreate { }

class PresetService {
    /**
     * 获取所有预设
     */
    async getPresets(): Promise<Preset[]> {
        const response = await apiClient.get<Preset[]>('/presets/');
        return response.data;
    }

    /**
     * 创建新预设
     */
    async createPreset(data: PresetCreate): Promise<Preset> {
        const response = await apiClient.post<Preset>('/presets/', data);
        return response.data;
    }

    /**
     * 更新预设
     */
    async updatePreset(id: number, data: PresetUpdate): Promise<Preset> {
        const response = await apiClient.put<Preset>(`/presets/${id}`, data);
        return response.data;
    }

    /**
     * 删除预设
     */
    async deletePreset(id: number): Promise<void> {
        await apiClient.delete(`/presets/${id}`);
    }

    /**
     * 解析预设内容
     */
    parsePresetContent(contentStr: string): PresetContent {
        try {
            return JSON.parse(contentStr);
        } catch {
            return { items: [] };
        }
    }

    /**
     * 序列化预设内容
     */
    stringifyPresetContent(content: PresetContent): string {
        return JSON.stringify(content);
    }

    /**
     * 生成唯一ID
     */
    generateItemId(): string {
        return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const presetService = new PresetService();
