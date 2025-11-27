import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresetItemRow } from './PresetItemRow';
import { PresetItemEditDialog } from './PresetItemEditDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Preset, PresetContent, PresetItem } from '@/services/presetService';
import { presetService } from '@/services/presetService';

interface PresetItemEditorProps {
    preset: Preset | null;
    onUpdatePreset: (id: number, content: string) => void;
}

export function PresetItemEditor({ preset, onUpdatePreset }: PresetItemEditorProps) {
    const [editingItem, setEditingItem] = useState<PresetItem | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    if (!preset) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>← 请从左侧选择一个预设</p>
            </div>
        );
    }

    const content = presetService.parsePresetContent(preset.content);
    const items = content.items || [];

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
                ...item,
                order: index,
            }));

            const newContent: PresetContent = { items: newItems };
            onUpdatePreset(preset.id, presetService.stringifyPresetContent(newContent));
        }
    };

    const handleAddItem = () => {
        const newItem: PresetItem = {
            id: presetService.generateItemId(),
            role: 'system',
            type: 'normal',
            name: '新建条目',
            content: '',
            order: items.length,
        };
        setEditingItem(newItem);
        setIsDialogOpen(true);
    };

    const handleEditItem = (item: PresetItem) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleSaveItem = (item: PresetItem) => {
        const existingIndex = items.findIndex((i) => i.id === item.id);
        let newItems: PresetItem[];

        if (existingIndex >= 0) {
            // 更新现有条目
            newItems = items.map((i) => (i.id === item.id ? item : i));
        } else {
            // 添加新条目
            newItems = [...items, item];
        }

        const newContent: PresetContent = { items: newItems };
        onUpdatePreset(preset.id, presetService.stringifyPresetContent(newContent));
        setIsDialogOpen(false);
    };

    const handleDeleteItem = (itemId: string) => {
        const newItems = items.filter((i) => i.id !== itemId);
        const newContent: PresetContent = { items: newItems };
        onUpdatePreset(preset.id, presetService.stringifyPresetContent(newContent));
    };

    const handleDuplicateItem = (item: PresetItem) => {
        const newItem: PresetItem = {
            ...item,
            id: presetService.generateItemId(),
            name: `${item.name} (副本)`,
            order: items.length,
        };
        const newItems = [...items, newItem];
        const newContent: PresetContent = { items: newItems };
        onUpdatePreset(preset.id, presetService.stringifyPresetContent(newContent));
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部 */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{preset.name}</h2>
                        <p className="text-sm text-muted-foreground">
                            {items.length} 个条目
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
                {items.length === 0 ? (
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
                            items={items.map((item) => item.id!)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <PresetItemRow
                                        key={item.id}
                                        item={item}
                                        onEdit={handleEditItem}
                                        onDelete={handleDeleteItem}
                                        onDuplicate={handleDuplicateItem}
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
                    item={editingItem}
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onSave={handleSaveItem}
                />
            )}
        </div>
    );
}
