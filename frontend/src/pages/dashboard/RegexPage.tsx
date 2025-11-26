import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';

interface RegexRule {
    id: number;
    name: string;
    pattern: string;
    replacement: string;
    type: 'pre' | 'post';
    is_active: boolean;
    sort_order: number;
}

export default function RegexPage() {
    const [rules, setRules] = useState<RegexRule[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<RegexRule | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        pattern: '',
        replacement: '',
        type: 'pre' as 'pre' | 'post',
        is_active: true
    });

    const fetchRules = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/v1/regex/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRules(response.data);
        } catch (error) {
            console.error('Failed to fetch rules', error);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            if (editingRule) {
                await axios.put(`/api/v1/regex/${editingRule.id}`,
                    { ...formData, sort_order: editingRule.sort_order },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                await axios.post('/api/v1/regex/',
                    { ...formData, sort_order: rules.length },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            setIsDialogOpen(false);
            fetchRules();
            resetForm();
        } catch (error) {
            console.error('Failed to save rule', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除此规则吗?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/v1/regex/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchRules();
        } catch (error) {
            console.error('Failed to delete rule', error);
        }
    };

    const resetForm = () => {
        setEditingRule(null);
        setFormData({ name: '', pattern: '', replacement: '', type: 'pre', is_active: true });
    };

    const openEdit = (rule: RegexRule) => {
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">正则规则</h1>
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
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingRule ? '编辑规则' : '新建规则'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">名称</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                                    <option value="pre">预处理 (请求)</option>
                                    <option value="post">后处理 (响应)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pattern">模式 (正则表达式)</Label>
                                <Input
                                    id="pattern"
                                    value={formData.pattern}
                                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                                    placeholder="e.g. \b(badword)\b"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="replacement">替换内容</Label>
                                <Input
                                    id="replacement"
                                    value={formData.replacement}
                                    onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                                    placeholder="e.g. ***"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="active">启用</Label>
                                <Switch
                                    id="active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit">保存</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden">
                {rules.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        未找到规则。创建一个开始吧。
                    </div>
                ) : (
                    <div className="divide-y">
                        {rules.map((rule) => (
                            <div key={rule.id} className="p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors">
                                <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{rule.name}</span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded",
                                            rule.type === 'pre' ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                        )}>
                                            {rule.type.toUpperCase()}
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
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(rule.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper for cn in this file if not imported
import { cn } from '@/lib/utils';
