import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresetItemRow } from './PresetItemRow';
import { PresetItemEditDialog } from './PresetItemEditDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Preset, PresetItem } from '@/services/presetService';
import { presetService } from '@/services/presetService';
import { useToast } from '@/hooks/useToast';

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
            name: '新建条目',
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

    return (
        <div className="flex flex-col h-full">
            {/* 头部 */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{preset.name}</h2>
                        <p className="text-sm text-muted-foreground">
                            {localItems.length} 个条目
                        </p>
                    </div>
                    <Button onClick={handleAddItem}>
                        <Plus className="w-4 h-4 mr-2" />
                        添加条目
                    </Button>
                </div>
            </div>

            {/* 条目列表 */}
            <ScrollArea className="flex-1 p-4">
                {localItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">暂无条目</p>
                        <p className="text-xs mt-1">点击"添加条目"创建第一个条目</p>
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
