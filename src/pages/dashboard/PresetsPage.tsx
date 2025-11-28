import { useState, useEffect } from 'react';
import { PresetItemEditor } from '@/components/preset/PresetItemEditor';
import { PresetRegexPage } from '@/components/preset/PresetRegexPage';
import { useToast } from '@/hooks/useToast';
import { presetService, type Preset } from '@/services/presetService';
import { presetRegexService } from '@/services/presetRegexService';
import { exportToJSON, importFromJSON } from '@/utils/exportImport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
            const newPresetData = await presetService.createPreset({
                name: '新建预设',
                is_active: true,
                sort_order: presets.length,
                content: '',
            });
            const newPreset = { ...newPresetData, items: [] };
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
                is_active: selectedPreset.is_active,
                sort_order: presets.length,
                content: selectedPreset.content || '',
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
    const handleExport = async () => {
        if (!selectedPreset) {
            toast({ variant: 'error', title: '请先选择一个预设' });
            return;
        }

        try {
            // 1. 获取预设内容
            // The preset items are now directly available on the selectedPreset object.
            const presetItems = selectedPreset.items || [];

            // 2. 获取关联的正则规则
            const regexRules = await presetRegexService.getPresetRegexRules(selectedPreset.id);

            // 3. 格式化正则规则用于导出
            const formattedRegex = regexRules.map(r => ({
                name: r.name,
                creator_username: r.creator_username,
                created_at: r.created_at,
                updated_at: r.updated_at,
                enabled: r.is_active, // 注意字段名转换
                content: {
                    type: r.type,
                    pattern: r.pattern,
                    replacement: r.replacement,
                }
            }));

            // 4. 组合成新的导出格式
            const exportData = {
                name: selectedPreset.name,
                type: 'preset',
                creator_username: (selectedPreset as any).creator_username || 'unknown',
                created_at: (selectedPreset as any).created_at || new Date().toISOString(),
                updated_at: (selectedPreset as any).updated_at || new Date().toISOString(),
                enabled: selectedPreset.is_active,
                content: {
                    preset: presetItems.map(item => ({
                        name: item.name,
                        creator_username: item.creator_username || 'unknown',
                        created_at: item.created_at,
                        updated_at: item.updated_at,
                        enabled: item.enabled,
                        role: item.role,
                        type: item.type,
                        content: item.content,
                    })),
                    regex: formattedRegex,
                }
            };

            exportToJSON(exportData, `gproxy-preset-${selectedPreset.name}`);
            toast({
                variant: 'success',
                title: '导出成功',
            });

        } catch (error) {
            toast({
                variant: 'error',
                title: '导出失败',
                description: '无法获取关联的正则数据',
            });
        }
    };

    // 导入预设
    const handleImport = async () => {
        try {
            const importedRaw = await importFromJSON<string>(true) as string; // Import as raw text
            const importedData = JSON.parse(importedRaw);


            // Case 1: Import a full preset
            if (importedData.type === 'preset') {
                const newPreset = await presetService.createPreset({
                    name: importedData.name,
                    is_active: importedData.enabled,
                    sort_order: presets.length,
                    content: importedRaw, // Pass the raw JSON content
                });

                if (importedData.content && importedData.content.preset) {
                    for (const item of importedData.content.preset) {
                        await presetService.createPresetItem(newPreset.id, {
                            name: item.name,
                            role: item.role,
                            type: item.type,
                            content: item.content,
                            enabled: item.enabled,
                            sort_order: importedData.content.preset.indexOf(item),
                        });
                    }
                }

                if (importedData.content && importedData.content.regex) {
                    for (const regexRule of importedData.content.regex) {
                        await presetRegexService.createPresetRegexRule(newPreset.id, {
                            name: regexRule.name,
                            pattern: regexRule.content.pattern,
                            replacement: regexRule.content.replacement,
                            type: regexRule.content.type,
                            is_active: regexRule.enabled,
                            sort_order: importedData.content.regex.indexOf(regexRule),
                        });
                    }
                }
                toast({
                    variant: 'success',
                    title: '导入成功',
                    description: `成功导入预设 "${importedData.name}"`,
                });
            }
            // Case 2: Import regex rules into the selected preset
            else {
                const rulesToImport = Array.isArray(importedData) ? importedData : [importedData];
                if (rulesToImport.every(r => r.type === 'regex' && r.content)) {
                    // This is a regex-only file. Guide the user to the correct import location.
                    toast({
                        variant: 'info',
                        title: '检测到正则规则文件',
                        description: '请在预设的“正则管理”选项卡中导入此文件。',
                        duration: 5000,
                    });
                } else {
                    throw new Error('文件格式不兼容。请选择一个预设文件。');
                }
            }

            // Refresh presets list
            await fetchPresets();

        } catch (error) {
            console.error("Import failed:", error);
            toast({
                variant: 'error',
                title: '导入失败',
                description: error instanceof Error ? error.message : '未知错误',
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
            {/* 顶部栏：标题 */}
            <div className="flex items-center justify-between px-4">
                <h1 className="text-3xl font-bold tracking-tight">预设</h1>
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
                                onItemsChange={fetchPresets}
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
