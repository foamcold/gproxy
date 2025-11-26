import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';

interface Preset {
    id: number;
    name: string;
    content: string;
    is_active: boolean;
    sort_order: number;
}

export default function PresetsPage() {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
    const [formData, setFormData] = useState({ name: '', content: '', is_active: true });

    const fetchPresets = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/v1/presets/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPresets(response.data);
        } catch (error) {
            console.error('Failed to fetch presets', error);
        }
    };

    useEffect(() => {
        fetchPresets();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            if (editingPreset) {
                await axios.put(`/api/v1/presets/${editingPreset.id}`,
                    { ...formData, sort_order: editingPreset.sort_order },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                await axios.post('/api/v1/presets/',
                    { ...formData, sort_order: presets.length },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            setIsDialogOpen(false);
            fetchPresets();
            resetForm();
        } catch (error) {
            console.error('Failed to save preset', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除此预设吗?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/v1/presets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPresets();
        } catch (error) {
            console.error('Failed to delete preset', error);
        }
    };

    const resetForm = () => {
        setEditingPreset(null);
        setFormData({ name: '', content: '', is_active: true });
    };

    const openEdit = (preset: Preset) => {
        setEditingPreset(preset);
        setFormData({
            name: preset.name,
            content: preset.content,
            is_active: preset.is_active
        });
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">预设</h1>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            添加预设
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingPreset ? '编辑预设' : '新建预设'}</DialogTitle>
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
                                <Label htmlFor="content">内容 (JSON)</Label>
                                <Textarea
                                    id="content"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="h-32 font-mono"
                                    placeholder='[{"role": "system", "content": "You are a helpful assistant."}]'
                                    required
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
                {presets.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        未找到预设。创建一个开始吧。
                    </div>
                ) : (
                    <div className="divide-y">
                        {presets.map((preset) => (
                            <div key={preset.id} className="p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors">
                                <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                                <div className="flex-1">
                                    <div className="font-medium flex items-center gap-2">
                                        {preset.name}
                                        {!preset.is_active && (
                                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">未启用</span>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate max-w-md">
                                        {preset.content}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(preset)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(preset.id)}>
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
