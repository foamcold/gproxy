import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Pencil, Trash2, GripVertical, FileDown, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { presetRegexService, type PresetRegexRule } from '@/services/presetRegexService';
import { exportToJSON, importFromJSON } from '@/utils/exportImport';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface SortableRuleItemProps {
    rule: PresetRegexRule;
    onEdit: (rule: PresetRegexRule) => void;
    onDelete: (id: number) => void;
    onExportSingle: (rule: PresetRegexRule) => void;
    onToggle: (id: number, active: boolean) => void;
}

function SortableRuleItem({ rule, onEdit, onDelete, onExportSingle, onToggle }: SortableRuleItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: rule.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors border-b last:border-b-0",
                isDragging && "shadow-lg ring-2 ring-primary"
            )}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100"
            >
                <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{rule.name}</span>
                    <span className={cn(
                        "text-xs px-2 py-0.5 rounded font-medium",
                        rule.type === 'pre'
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100"
                    )}>
                        {rule.type === 'pre' ? '预处理' : '后处理'}
                    </span>
                    {!rule.is_active && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">未启用</span>
                    )}
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                    s/{rule.pattern}/{rule.replacement}/g
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => onToggle(rule.id, checked)}
                    onClick={(e) => e.stopPropagation()}
                />
                <Button variant="ghost" size="icon" onClick={() => onExportSingle(rule)} title="导出此规则">
                    <FileDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(rule)}>
                    <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(rule.id)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

interface PresetRegexPageProps {
    presetId: number;
}

export function PresetRegexPage({ presetId }: PresetRegexPageProps) {
    const [rules, setRules] = useState<PresetRegexRule[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<PresetRegexRule | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        pattern: '',
        replacement: '',
        type: 'pre' as 'pre' | 'post',
        is_active: true
    });
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchRules = async () => {
        try {
            const data = await presetRegexService.getPresetRegexRules(presetId);
            setRules(data.sort((a, b) => a.sort_order - b.sort_order));
        } catch (error) {
            toast({
                variant: 'error',
                title: '加载失败',
                description: '无法加载预设正则',
            });
        }
    };

    useEffect(() => {
        fetchRules();
    }, [presetId]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = rules.findIndex((r) => r.id === active.id);
            const newIndex = rules.findIndex((r) => r.id === over.id);

            const newRules = arrayMove(rules, oldIndex, newIndex).map((r, index) => ({
                ...r,
                sort_order: index,
            }));

            setRules(newRules);
            updateRulesOrder(newRules);
        }
    };

    const updateRulesOrder = async (updatedRules: PresetRegexRule[]) => {
        try {
            await Promise.all(
                updatedRules.map((rule) =>
                    presetRegexService.updatePresetRegexRule(presetId, rule.id, {
                        name: rule.name,
                        pattern: rule.pattern,
                        replacement: rule.replacement,
                        type: rule.type,
                        is_active: rule.is_active,
                        sort_order: rule.sort_order,
                    })
                )
            );
        } catch (error) {
            toast({
                variant: 'error',
                title: '更新失败',
                description: '无法更新排序',
            });
        }
    };

    const handleToggleRule = async (id: number, active: boolean) => {
        const rule = rules.find(r => r.id === id);
        if (!rule) return;

        try {
            await presetRegexService.updatePresetRegexRule(presetId, id, {
                name: rule.name,
                pattern: rule.pattern,
                replacement: rule.replacement,
                type: rule.type,
                is_active: active,
                sort_order: rule.sort_order,
            });

            setRules(rules.map(r => r.id === id ? { ...r, is_active: active } : r));
            toast({ variant: 'success', title: active ? '已启用' : '已禁用' });
        } catch (error) {
            toast({ variant: 'error', title: '更新状态失败' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRule) {
                await presetRegexService.updatePresetRegexRule(presetId, editingRule.id, {
                    ...formData,
                    sort_order: editingRule.sort_order
                });
                toast({ variant: 'success', title: '更新成功' });
            } else {
                await presetRegexService.createPresetRegexRule(presetId, {
                    ...formData,
                    sort_order: rules.length
                });
                toast({ variant: 'success', title: '创建成功' });
            }
            setIsDialogOpen(false);
            fetchRules();
            resetForm();
        } catch (error) {
            toast({ variant: 'error', title: editingRule ? '更新失败' : '创建失败' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除此规则吗?')) return;
        try {
            await presetRegexService.deletePresetRegexRule(presetId, id);
            fetchRules();
            toast({ variant: 'success', title: '删除成功' });
        } catch (error) {
            toast({ variant: 'error', title: '删除失败' });
        }
    };

    const resetForm = () => {
        setEditingRule(null);
        setFormData({ name: '', pattern: '', replacement: '', type: 'pre', is_active: true });
    };

    const openEdit = (rule: PresetRegexRule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            pattern: rule.pattern,
            replacement: rule.replacement,
            type: rule.type,
            is_active: rule.is_active
        });
        setIsDialogOpen(true);
    };

    const handleExportSingle = (rule: PresetRegexRule) => {
        const exportData = {
            name: rule.name,
            type: 'regex',
            creator_username: rule.creator_username || 'unknown',
            created_at: rule.created_at || new Date().toISOString(),
            updated_at: rule.updated_at || new Date().toISOString(),
            enabled: rule.is_active,
            content: {
                type: rule.type,
                pattern: rule.pattern,
                replacement: rule.replacement,
            }
        };

        exportToJSON(exportData, `gproxy-preset-regex-${rule.name}`);
        toast({ variant: 'success', title: '导出成功' });
    };

    const handleExportRules = () => {
        const exportData = rules.map(rule => ({
            name: rule.name,
            type: 'regex',
            creator_username: rule.creator_username || 'unknown',
            created_at: rule.created_at || new Date().toISOString(),
            updated_at: rule.updated_at || new Date().toISOString(),
            enabled: rule.is_active,
            content: {
                type: rule.type,
                pattern: rule.pattern,
                replacement: rule.replacement,
            }
        }));

        exportToJSON(exportData, `gproxy-preset-regex-rules`);
        toast({ variant: 'success', title: '导出成功' });
    };

    const handleImportRules = async () => {
        try {
            const importedData = await importFromJSON<any>();
            let rulesToImport = [];

            // Case 1: Import from a preset file
            if (importedData.type === 'preset' && importedData.content && Array.isArray(importedData.content.regex)) {
                rulesToImport = importedData.content.regex;
            }
            // Case 2: Import from a regex file (array or single object)
            else {
                rulesToImport = Array.isArray(importedData) ? importedData : [importedData];
            }

            if (rulesToImport.length === 0) {
                toast({
                    variant: 'info',
                    title: '没有可导入的规则',
                    description: '文件中未找到兼容的正则规则。',
                });
                return;
            }

            for (const rule of rulesToImport) {
                // Preset files have a different structure
                const ruleContent = rule.content || {};
                await presetRegexService.createPresetRegexRule(presetId, {
                    name: rule.name,
                    pattern: ruleContent.pattern,
                    replacement: ruleContent.replacement,
                    type: ruleContent.type,
                    is_active: rule.enabled,
                    sort_order: rules.length + rulesToImport.indexOf(rule),
                });
            }

            fetchRules();
            toast({
                variant: 'success',
                title: '导入成功',
                description: `成功导入 ${rulesToImport.length} 条规则`,
            });
        } catch (error) {
            toast({ variant: 'error', title: '导入失败', description: '文件格式可能不兼容' });
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center px-4 pt-4">
                <h2 className="text-lg font-semibold">预设内部正则</h2>
                <div className="flex items-center gap-2">
                    <Button onClick={handleExportRules} variant="outline" size="sm" disabled={rules.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        导出
                    </Button>
                    <Button onClick={handleImportRules} variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        导入
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                添加规则
                            </Button>
                        </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingRule ? '编辑规则' : '新建规则'}</DialogTitle>
                            <DialogDescription>
                                支持标准正则表达式语法和捕获组替换（$1, $2, ...）
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">名称</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="例如：过滤敏感词"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">类型</Label>
                                <select
                                    id="type"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'pre' | 'post' })}
                                >
                                    <option value="pre">预处理 (处理用户请求)</option>
                                    <option value="post">后处理 (处理AI响应)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pattern">正则表达式模式</Label>
                                <Input
                                    id="pattern"
                                    value={formData.pattern}
                                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                                    placeholder="例如：\b(你好|hello)\b"
                                    className="font-mono"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="replacement">替换内容</Label>
                                <Textarea
                                    id="replacement"
                                    value={formData.replacement}
                                    onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                                    placeholder="例如：$1 世界  或  ***"
                                    className="font-mono h-20"
                                />
                            </div>
                            <DialogFooter className="sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="active">启用此规则</Label>
                                </div>
                                <Button type="submit">保存</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex-1 bg-card border rounded-lg overflow-hidden mx-4 mb-4">
                {rules.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p className="text-sm">暂无规则</p>
                        <p className="text-xs mt-1">点击"添加规则"创建第一条规则</p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={rules.map((r) => r.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div>
                                {rules.map((rule) => (
                                    <SortableRuleItem
                                        key={rule.id}
                                        rule={rule}
                                        onEdit={openEdit}
                                        onDelete={handleDelete}
                                        onExportSingle={handleExportSingle}
                                        onToggle={handleToggleRule}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>
        </div>
    );
}
