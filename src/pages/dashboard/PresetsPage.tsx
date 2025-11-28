import { useState, useEffect } from 'react';
import { PresetItemEditor } from '@/components/preset/PresetItemEditor';
import { PresetRegexPage } from '@/components/preset/PresetRegexPage';
import { useToast } from '@/hooks/useToast';
import { presetService, type Preset, type PresetContent } from '@/services/presetService';
import { exportToJSON, importFromJSON } from '@/utils/exportImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    Plus,
    Copy,
    Trash2,
    Download,
    Upload,
    Pencil,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function PresetsPage() {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
    const [loading, setLoading] = useState(true);
    const [globalEnabled, setGlobalEnabled] = useState(false);

    // Rename Dialog State
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renameName, setRenameName] = useState('');

    const { toast } = useToast();

    // 加载预设列表
    const fetchPresets = async () => {
        try {
            setLoading(true);
            const data = await presetService.getPresets();
            const sortedData = data.sort((a, b) => a.sort_order - b.sort_order);
            setPresets(sortedData);

            // 如果有选中的预设，更新它；否则默认选中第一个
            if (selectedPreset) {
                const updated = data.find((p) => p.id === selectedPreset.id);
                if (updated) {
                    setSelectedPreset(updated);
                } else if (sortedData.length > 0) {
                    setSelectedPreset(sortedData[0]);
                } else {
                    setSelectedPreset(null);
                }
            } else if (sortedData.length > 0) {
                setSelectedPreset(sortedData[0]);
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
            const newPresets = [...presets, newPreset];
            setPresets(newPresets);
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

    // 切换预设启用状态 (Current Selected)
    const handleToggleActive = async (checked: boolean) => {
        if (!selectedPreset) return;
        try {
            await presetService.updatePreset(selectedPreset.id, {
                name: selectedPreset.name,
                content: selectedPreset.content,
                is_active: checked,
                sort_order: selectedPreset.sort_order,
            });

            const updatedPreset = { ...selectedPreset, is_active: checked };
            setPresets(presets.map((p) => (p.id === selectedPreset.id ? updatedPreset : p)));
            setSelectedPreset(updatedPreset);
        } catch (error) {
            toast({
                variant: 'error',
                title: '更新失败',
            });
        }
    };

    // 打开重命名弹窗
    const openRenameDialog = () => {
        if (!selectedPreset) return;
        setRenameName(selectedPreset.name);
        setIsRenameDialogOpen(true);
    };

    // 执行重命名
    const handleRename = async () => {
        if (!selectedPreset || !renameName.trim()) return;
        try {
            await presetService.updatePreset(selectedPreset.id, {
                name: renameName,
                content: selectedPreset.content,
                is_active: selectedPreset.is_active,
                sort_order: selectedPreset.sort_order,
            });

            const updatedPreset = { ...selectedPreset, name: renameName };
            setPresets(presets.map((p) => (p.id === selectedPreset.id ? updatedPreset : p)));
            setSelectedPreset(updatedPreset);
            setIsRenameDialogOpen(false);
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
    const handleDelete = async () => {
        if (!selectedPreset) return;
        if (!confirm(`确定要删除预设 "${selectedPreset.name}" 吗？`)) return;

        try {
            await presetService.deletePreset(selectedPreset.id);
            const newPresets = presets.filter((p) => p.id !== selectedPreset.id);
            setPresets(newPresets);

            if (newPresets.length > 0) {
                setSelectedPreset(newPresets[0]);
            } else {
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
    const handleDuplicate = async () => {
        if (!selectedPreset) return;
        try {
            const newPreset = await presetService.createPreset({
                name: `${selectedPreset.name} (副本)`,
                content: selectedPreset.content,
                is_active: selectedPreset.is_active,
                sort_order: presets.length,
            });
            setPresets([...presets, newPreset]);
            setSelectedPreset(newPreset);
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

    // 导出预设（仅导出选中的）
    const handleExport = () => {
        if (!selectedPreset) {
            toast({ variant: 'error', title: '请先选择一个预设' });
            return;
        }

        const content = presetService.parsePresetContent(selectedPreset.content);
        const exportData = {
            name: selectedPreset.name,
            content: JSON.stringify(content, null, 2),
            is_active: selectedPreset.is_active,
            creator_username: (selectedPreset as any).creator_username || 'unknown',
            created_at: (selectedPreset as any).created_at || new Date().toISOString(),
            updated_at: (selectedPreset as any).updated_at || new Date().toISOString(),
        };

        exportToJSON(exportData, `gproxy-preset-${selectedPreset.name}`);
        toast({
            variant: 'success',
            title: '导出成功',
        });
    };

    // 导入预设
    const handleImport = async () => {
        try {
            const importedPresets = await importFromJSON<Preset[]>();
            const newPresetsList = [...presets];

            for (const preset of importedPresets) {
                const newPreset = await presetService.createPreset({
                    name: preset.name,
                    content: preset.content,
                    is_active: preset.is_active,
                    sort_order: presets.length + importedPresets.indexOf(preset),
                });
                newPresetsList.push(newPreset);
            }

            setPresets(newPresetsList);
            // 如果之前没有选中预设，导入后选中第一个导入的
            if (!selectedPreset && newPresetsList.length > 0) {
                setSelectedPreset(newPresetsList[newPresetsList.length - importedPresets.length]);
            }

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
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
            {/* 顶部栏：标题和全局开关 */}
            <div className="flex items-center justify-between px-4">
                <h1 className="text-3xl font-bold tracking-tight">预设</h1>
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md">
                    <Label htmlFor="preset-global-switch" className="text-sm font-medium cursor-pointer">
                        {globalEnabled ? '已启用' : '已禁用'}
                    </Label>
                    <Switch
                        id="preset-global-switch"
                        checked={globalEnabled}
                        onCheckedChange={setGlobalEnabled}
                    />
                </div>
            </div>

            {/* 功能工具栏 */}
            <div className="flex items-center gap-4 px-4 py-2 bg-card border rounded-lg mx-4 shadow-sm">
                {/* 预设选择下拉框 */}
                <div className="flex-1 max-w-xs">
                    <Select
                        value={selectedPreset?.id.toString()}
                        onValueChange={(val) => {
                            const preset = presets.find(p => p.id === parseInt(val));
                            if (preset) setSelectedPreset(preset);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="选择预设..." />
                        </SelectTrigger>
                        <SelectContent>
                            {presets.map((preset) => (
                                <SelectItem key={preset.id} value={preset.id.toString()}>
                                    {preset.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 预设开关 (仅针对当前选中) */}
                {selectedPreset && (
                    <div className="flex items-center gap-2 border-l pl-4">
                        <Label htmlFor="current-preset-switch" className="text-sm cursor-pointer">
                            启用此预设
                        </Label>
                        <Switch
                            id="current-preset-switch"
                            checked={selectedPreset.is_active}
                            onCheckedChange={handleToggleActive}
                        />
                    </div>
                )}

                {/* 操作按钮组 */}
                <div className="flex items-center gap-1 ml-auto">
                    <Button variant="ghost" size="icon" onClick={openRenameDialog} disabled={!selectedPreset} title="重命名">
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button variant="ghost" size="icon" onClick={handleCreatePreset} title="新建预设">
                        <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDuplicate} disabled={!selectedPreset} title="复制预设">
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={!selectedPreset} className="text-destructive hover:text-destructive" title="删除预设">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button variant="ghost" size="icon" onClick={handleExport} disabled={!selectedPreset} title="导出选中预设">
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleImport} title="导入预设">
                        <Upload className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* 主内容区域 */}
            <div className="flex-1 border rounded-lg bg-card overflow-hidden mx-4 mb-4">
                {!selectedPreset ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>请选择或创建一个预设</p>
                    </div>
                ) : (
                    <Tabs defaultValue="items" className="h-full flex flex-col">
                        <TabsList className="w-full rounded-none border-b bg-muted/50 justify-start px-4">
                            <TabsTrigger value="items">预设管理</TabsTrigger>
                            <TabsTrigger value="regex">正则管理</TabsTrigger>
                        </TabsList>
                        <TabsContent value="items" className="flex-1 m-0 overflow-hidden">
                            <PresetItemEditor
                                preset={selectedPreset}
                                onUpdatePreset={handleUpdatePresetContent}
                            />
                        </TabsContent>
                        <TabsContent value="regex" className="flex-1 m-0 overflow-hidden">
                            <PresetRegexPage presetId={selectedPreset.id} />
                        </TabsContent>
                    </Tabs>
                )}
            </div>

            {/* 重命名弹窗 */}
            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>重命名预设</DialogTitle>
                        <DialogDescription>
                            请输入新的预设名称
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            placeholder="预设名称"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>取消</Button>
                        <Button onClick={handleRename}>确定</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
