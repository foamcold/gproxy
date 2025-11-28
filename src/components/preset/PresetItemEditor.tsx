import { useState, useEffect, useCallback, useRef } from 'react';
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
    const [localItems, setLocalItems] = useState<PresetItem[]>([]);
    const itemsRef = useRef(localItems);
    itemsRef.current = localItems;

    // 创建一个防抖函数来延迟更新
    const debouncedUpdate = useCallback(
        debounce((id: number, content: string) => {
            onUpdatePreset(id, content);
        }, 500),
        [onUpdatePreset]
    );

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor)
    );

    // Sync local items with preset content when preset changes
    useEffect(() => {
        if (preset) {
            const content = presetService.parsePresetContent(preset.content);
            setLocalItems(content.items || []);
        } else {
            setLocalItems([]);
        }
    }, [preset]);

    // 防抖函数
    function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
        let timeoutId: ReturnType<typeof setTimeout>;
        return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        } as T;
    }

    if (!preset) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>请选择一个预设</p>
            </div>
        );
    }

    // Helper to update both local state and parent/server
    const updateItems = (newItems: PresetItem[]) => {
        setLocalItems(newItems);
        const newContent: PresetContent = { items: newItems };
        debouncedUpdate(preset.id, presetService.stringifyPresetContent(newContent));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = localItems.findIndex((item) => item.id === active.id);
            const newIndex = localItems.findIndex((item) => item.id === over.id);

            const newItems = arrayMove(localItems, oldIndex, newIndex).map((item, index) => ({
                ...item,
                order: index,
            }));

            // 只更新本地状态以获得即时反馈
            setLocalItems(newItems);

            // 使用防抖函数进行后台更新
            const newContent: PresetContent = { items: newItems };
            debouncedUpdate(preset.id, presetService.stringifyPresetContent(newContent));
        }
    };

    const handleAddItem = () => {
        const newItem: PresetItem = {
            id: presetService.generateItemId(),
            role: 'system',
            type: 'normal',
            name: '新建条目',
            content: '',
            order: localItems.length,
            enabled: true,
        };
        setEditingItem(newItem);
        setIsDialogOpen(true);
    };

    const handleEditItem = (item: PresetItem) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleSaveItem = (item: PresetItem) => {
        const existingIndex = localItems.findIndex((i) => i.id === item.id);
        let newItems: PresetItem[];

        if (existingIndex >= 0) {
            // 更新现有条目
            newItems = localItems.map((i) => (i.id === item.id ? item : i));
        } else {
            // 添加新条目
            newItems = [...localItems, item];
        }

        updateItems(newItems);
        setIsDialogOpen(false);
        // Clear editing item to prevent stale data issues
        setEditingItem(null);
    };

    const handleDeleteItem = (itemId: string) => {
        const newItems = localItems.filter((i) => i.id !== itemId);
        updateItems(newItems);
    };

    const handleDuplicateItem = (item: PresetItem) => {
        const newItem: PresetItem = {
            ...item,
            id: presetService.generateItemId(),
            name: `${item.name} (副本)`,
            order: localItems.length,
            enabled: item.enabled !== false, // Copy enabled state
        };
        const newItems = [...localItems, newItem];
        updateItems(newItems);
    };

    const handleToggleEnabled = (item: PresetItem, enabled: boolean) => {
        const newItems = localItems.map((i) =>
            i.id === item.id ? { ...i, enabled } : i
        );
        updateItems(newItems);
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
                            items={localItems.map((item) => item.id!)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-2">
                                {localItems.map((item) => (
                                    <PresetItemRow
                                        key={item.id}
                                        item={item}
                                        onEdit={handleEditItem}
                                        onDelete={handleDeleteItem}
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
                    item={editingItem}
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
