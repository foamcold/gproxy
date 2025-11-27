import { useState, useEffect } from 'react';
import { PresetList } from '@/components/preset/PresetList';
import { PresetItemEditor } from '@/components/preset/PresetItemEditor';
import { useToast } from '@/hooks/useToast';
import { presetService, type Preset, type PresetContent } from '@/services/presetService';
import { exportToJSON, importFromJSON } from '@/utils/exportImport';

export default function PresetsPage() {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // 加载预设列表
    const fetchPresets = async () => {
        try {
            setLoading(true);
            const data = await presetService.getPresets();
            setPresets(data.sort((a, b) => a.sort_order - b.sort_order));
            // 如果有选中的预设，更新它
            if (selectedPreset) {
                const updated = data.find((p) => p.id === selectedPreset.id);
                if (updated) setSelectedPreset(updated);
            }
        } catch (error) {
            toast({
                variant: 'error',
                title: '加载失败',
                description: '无法加载预设列表',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPresets();
    }, []);

    // 创建新预设
    const handleCreatePreset = async () => {
        try {
            const emptyContent: PresetContent = { items: [] };
            const newPreset = await presetService.createPreset({
                name: '新建预设',
                content: presetService.stringifyPresetContent(emptyContent),
                is_active: true,
                sort_order: presets.length,
            });
            setPresets([...presets, newPreset]);
            setSelectedPreset(newPreset);
            toast({
                variant: 'success',
                title: '创建成功',
                description: '新预设已创建',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '创建失败',
                description: '无法创建新预设',
            });
        }
    };

    // 更新预设列表顺序
    const handleUpdatePresets = async (updatedPresets: Preset[]) => {
        setPresets(updatedPresets);
        // 批量更新排序
        try {
            await Promise.all(
                updatedPresets.map((preset) =>
                    presetService.updatePreset(preset.id, {
                        name: preset.name,
                        content: preset.content,
                        is_active: preset.is_active,
                        sort_order: preset.sort_order,
                    })
                )
            );
        } catch (error) {
            toast({
                variant: 'error',
                title: '更新失败',
                description: '无法更新预设顺序',
            });
        }
    };

    // 切换预设启用状态
    const handleToggleActive = async (id: number, isActive: boolean) => {
        try {
            const preset = presets.find((p) => p.id === id);
            if (!preset) return;

            await presetService.updatePreset(id, {
                name: preset.name,
                content: preset.content,
                is_active: isActive,
                sort_order: preset.sort_order,
            });

            setPresets(presets.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)));
            if (selectedPreset?.id === id) {
                setSelectedPreset({ ...selectedPreset, is_active: isActive });
            }
        } catch (error) {
            toast({
                variant: 'error',
                title: '更新失败',
            });
        }
    };

    // 重命名预设
    const handleRename = async (id: number, newName: string) => {
        try {
            const preset = presets.find((p) => p.id === id);
            if (!preset) return;

            await presetService.updatePreset(id, {
                name: newName,
                content: preset.content,
                is_active: preset.is_active,
                sort_order: preset.sort_order,
            });

            setPresets(presets.map((p) => (p.id === id ? { ...p, name: newName } : p)));
            if (selectedPreset?.id === id) {
                setSelectedPreset({ ...selectedPreset, name: newName });
            }
            toast({
                variant: 'success',
                title: '重命名成功',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '重命名失败',
            });
        }
    };

    // 删除预设
    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除此预设吗？')) return;

        try {
            await presetService.deletePreset(id);
            setPresets(presets.filter((p) => p.id !== id));
            if (selectedPreset?.id === id) {
                setSelectedPreset(null);
            }
            toast({
                variant: 'success',
                title: '删除成功',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '删除失败',
            });
        }
    };

    // 复制预设
    const handleDuplicate = async (preset: Preset) => {
        try {
            const newPreset = await presetService.createPreset({
                name: `${preset.name} (副本)`,
                content: preset.content,
                is_active: preset.is_active,
                sort_order: presets.length,
            });
            setPresets([...presets, newPreset]);
            toast({
                variant: 'success',
                title: '复制成功',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '复制失败',
            });
        }
    };

    // 导出预设
    const handleExport = () => {
        exportToJSON(presets, 'gproxy-presets');
        toast({
            variant: 'success',
            title: '导出成功',
        });
    };

    // 导入预设
    const handleImport = async () => {
        try {
            const importedPresets = await importFromJSON<Preset[]>();
            // 导入预设到服务器
            for (const preset of importedPresets) {
                await presetService.createPreset({
                    name: preset.name,
                    content: preset.content,
                    is_active: preset.is_active,
                    sort_order: presets.length + importedPresets.indexOf(preset),
                });
            }
            fetchPresets();
            toast({
                variant: 'success',
                title: '导入成功',
                description: `成功导入 ${importedPresets.length} 个预设`,
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '导入失败',
            });
        }
    };

    // 更新预设内容
    const handleUpdatePresetContent = async (id: number, content: string) => {
        try {
            const preset = presets.find((p) => p.id === id);
            if (!preset) return;

            await presetService.updatePreset(id, {
                name: preset.name,
                content,
                is_active: preset.is_active,
                sort_order: preset.sort_order,
            });

            const updatedPreset = { ...preset, content };
            setPresets(presets.map((p) => (p.id === id ? updatedPreset : p)));
            setSelectedPreset(updatedPreset);
        } catch (error) {
            toast({
                variant: 'error',
                title: '保存失败',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">加载中...</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-4">
            {/* 左侧：预设列表 (1/4宽度) */}
            <div className="w-1/4">
                <PresetList
                    presets={presets}
                    selectedPresetId={selectedPreset?.id || null}
                    onSelectPreset={setSelectedPreset}
                    onCreatePreset={handleCreatePreset}
                    onUpdatePresets={handleUpdatePresets}
                    onToggleActive={handleToggleActive}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                    onExport={handleExport}
                    onImport={handleImport}
                />
            </div>

            {/* 右侧：预设条目编辑器 (3/4宽度) */}
            <div className="flex-1 border rounded-lg bg-card">
                <PresetItemEditor
                    preset={selectedPreset}
                    onUpdatePreset={handleUpdatePresetContent}
                />
            </div>
        </div>
    );
}
