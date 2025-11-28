import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresetItemRow } from './PresetItemRow';
import { PresetItemEditDialog } from './PresetItemEditDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Preset, PresetItem } from '@/services/presetService';
import { presetService } from '@/services/presetService';
import { useToast } from '@/hooks/useToast';
import { exportToJSON, importFromJSON } from '@/utils/exportImport';

interface PresetItemEditorProps {
    preset: Preset;
    onItemsChange: () => void;
}

export function PresetItemEditor({ preset, onItemsChange }: PresetItemEditorProps) {
    const [editingItem, setEditingItem] = useState<PresetItem | Partial<PresetItem> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );
    
    const localItems = preset.items || [];

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = localItems.findIndex((item) => item.id === active.id);
            const newIndex = localItems.findIndex((item) => item.id === over.id);
            const newItems = arrayMove(localItems, oldIndex, newIndex);

            onItemsChange(); // Optimistic update

            try {
                // Update sort order for all affected items
                await Promise.all(newItems.map((item, index) =>
                    presetService.updatePresetItem(preset.id, item.id, { sort_order: index })
                ));
            } catch (error) {
                toast({ variant: 'error', title: '排序失败' });
                onItemsChange(); // Revert on failure
            }
        }
    };

    const handleAddItem = () => {
        const newItem: Partial<PresetItem> = {
            role: 'system',
            type: 'normal',
            name: '新建消息',
            content: '',
            sort_order: localItems.length,
            enabled: true,
        };
        setEditingItem(newItem);
        setIsDialogOpen(true);
    };

    const handleEditItem = (item: PresetItem) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleSaveItem = async (item: PresetItem | Partial<PresetItem>) => {
        try {
            if ('id' in item && item.id) {
                // Update
                await presetService.updatePresetItem(preset.id, item.id, item);
            } else {
                // Create
                await presetService.createPresetItem(preset.id, item as any);
            }
            onItemsChange();
            setIsDialogOpen(false);
            setEditingItem(null);
            toast({ variant: 'success', title: '保存成功' });
        } catch (error) {
            toast({ variant: 'error', title: '保存失败' });
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        try {
            await presetService.deletePresetItem(preset.id, itemId);
            onItemsChange();
            toast({ variant: 'success', title: '删除成功' });
        } catch (error) {
            toast({ variant: 'error', title: '删除失败' });
        }
    };

    const handleDuplicateItem = async (item: PresetItem) => {
        try {
            await presetService.createPresetItem(preset.id, {
                ...item,
                name: `${item.name} (副本)`,
                sort_order: localItems.length,
            });
            onItemsChange();
            toast({ variant: 'success', title: '复制成功' });
        } catch (error) {
            toast({ variant: 'error', title: '复制失败' });
        }
    };

    const handleToggleEnabled = async (item: PresetItem, enabled: boolean) => {
        try {
            await presetService.updatePresetItem(preset.id, item.id, { enabled });
            onItemsChange();
        } catch (error) {
            toast({ variant: 'error', title: '更新失败' });
        }
    };

    const handleExportItems = () => {
        const presetItems = localItems.map(item => ({
            name: item.name,
            creator_username: item.creator_username || 'unknown',
            created_at: item.created_at,
            updated_at: item.updated_at,
            enabled: item.enabled,
            role: item.role,
            type: item.type,
            content: item.content,
        }));

        const exportData = {
            name: preset.name,
            type: 'preset',
            creator_username: (preset as any).creator_username || 'unknown',
            created_at: (preset as any).created_at || new Date().toISOString(),
            updated_at: (preset as any).updated_at || new Date().toISOString(),
            enabled: preset.is_active,
            content: {
                preset: presetItems,
                regex: [], // Intentionally empty as we are only exporting items
            }
        };

        exportToJSON(exportData, `gproxy-preset-items-${preset.name}`);
        toast({
            variant: 'success',
            title: '导出成功',
            description: `成功导出 ${localItems.length} 条消息`,
        });
    };

    const handleImportItems = async () => {
        try {
            const importedData = await importFromJSON<any>();
            let itemsToImport = [];

            // Handle both array of items and full preset object
            if (Array.isArray(importedData)) {
                itemsToImport = importedData;
            } else if (importedData.type === 'preset' && importedData.content && Array.isArray(importedData.content.preset)) {
                itemsToImport = importedData.content.preset;
            } else {
                throw new Error('文件格式不兼容');
            }

            for (const item of itemsToImport) {
                await presetService.createPresetItem(preset.id, {
                    name: item.name,
                    role: item.role,
                    type: item.type,
                    content: item.content,
                    enabled: item.enabled,
                    sort_order: localItems.length + itemsToImport.indexOf(item),
                });
            }

            onItemsChange();
            toast({
                variant: 'success',
                title: '导入成功',
                description: `成功导入 ${itemsToImport.length} 条消息`,
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '导入失败',
                description: error instanceof Error ? error.message : '未知错误',
            });
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部 */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">预设内部消息</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            当前共 {localItems.length} 条消息
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleExportItems} variant="outline" size="sm" disabled={localItems.length === 0}>
                            <Download className="w-4 h-4 mr-2" />
                            导出
                        </Button>
                        <Button onClick={handleImportItems} variant="outline" size="sm">
                            <Upload className="w-4 h-4 mr-2" />
                            导入
                        </Button>
                        <Button onClick={handleAddItem} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            添加消息
                        </Button>
                    </div>
                </div>
            </div>

            {/* 条目列表 */}
            <ScrollArea className="flex-1 p-4">
                {localItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">暂无消息</p>
                        <p className="text-xs mt-1">点击"添加消息"创建第一条消息</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={localItems.map((item) => item.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {localItems.map((item) => (
                                    <PresetItemRow
                                        key={item.id}
                                        item={item}
                                        onEdit={handleEditItem}
                                        onDelete={() => handleDeleteItem(item.id)}
                                        onDuplicate={handleDuplicateItem}
                                        onToggle={handleToggleEnabled}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </ScrollArea>

            {/* 编辑弹窗 */}
            {editingItem && (
                <PresetItemEditDialog
                    item={editingItem as PresetItem}
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) setEditingItem(null);
                    }}
                    onSave={handleSaveItem}
                />
            )}
        </div>
    );
}
