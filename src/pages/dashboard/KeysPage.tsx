import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Copy } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface OfficialKey {
    id: number;
    key: string;
    usage_count: number;
    last_status: string;
    is_active: boolean;
}

interface ExclusiveKey {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
}

export default function KeysPage() {
    const [officialKeys, setOfficialKeys] = useState<OfficialKey[]>([]);
    const [exclusiveKeys, setExclusiveKeys] = useState<ExclusiveKey[]>([]);
    const [isOfficialDialogOpen, setIsOfficialDialogOpen] = useState(false);
    const [isExclusiveDialogOpen, setIsExclusiveDialogOpen] = useState(false);

    const [officialForm, setOfficialForm] = useState({ key: '', is_active: true });
    const [exclusiveForm, setExclusiveForm] = useState({ name: '', is_active: true });

    const fetchKeys = async () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [officialRes, exclusiveRes] = await Promise.all([
                axios.get('/api/v1/keys/official', { headers }),
                axios.get('/api/v1/keys/exclusive', { headers })
            ]);
            setOfficialKeys(officialRes.data);
            setExclusiveKeys(exclusiveRes.data);
        } catch (error) {
            console.error('Failed to fetch keys', error);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreateOfficial = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('/api/v1/keys/official', officialForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsOfficialDialogOpen(false);
            setOfficialForm({ key: '', is_active: true });
            fetchKeys();
        } catch (error) {
            console.error('Failed to create official key', error);
        }
    };

    const handleCreateExclusive = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('/api/v1/keys/exclusive', exclusiveForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsExclusiveDialogOpen(false);
            setExclusiveForm({ name: '', is_active: true });
            fetchKeys();
        } catch (error) {
            console.error('Failed to create exclusive key', error);
        }
    };

    const handleDeleteOfficial = async (id: number) => {
        if (!confirm('删除此官方密钥?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/v1/keys/official/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchKeys();
        } catch (error) {
            console.error('Failed to delete official key', error);
        }
    };

    const handleDeleteExclusive = async (id: number) => {
        if (!confirm('删除此专属密钥?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/v1/keys/exclusive/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchKeys();
        } catch (error) {
            console.error('Failed to delete exclusive key', error);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add toast here
    };

    return (
        <div className="space-y-8">
            {/* Exclusive Keys Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">专属密钥</h2>
                        <p className="text-muted-foreground">您访问代理的个人密钥。</p>
                    </div>
                    <Dialog open={isExclusiveDialogOpen} onOpenChange={setIsExclusiveDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                生成密钥
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>生成专属密钥</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateExclusive} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ex-name">名称 (可选)</Label>
                                    <Input
                                        id="ex-name"
                                        value={exclusiveForm.name}
                                        onChange={(e) => setExclusiveForm({ ...exclusiveForm, name: e.target.value })}
                                        placeholder="My App Key"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">生成</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {exclusiveKeys.map((key) => (
                        <div key={key.id} className="bg-card border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="font-medium">{key.name || '未命名密钥'}</div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteExclusive(key.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="bg-muted p-2 rounded text-xs font-mono break-all flex items-center justify-between gap-2">
                                <span>{key.key}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(key.key)}>
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className={cn("w-2 h-2 rounded-full", key.is_active ? "bg-green-500" : "bg-red-500")} />
                                {key.is_active ? "启用" : "未启用"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t pt-8 space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">官方密钥</h2>
                        <p className="text-muted-foreground">用于轮询的后端密钥。</p>
                    </div>
                    <Dialog open={isOfficialDialogOpen} onOpenChange={setIsOfficialDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                添加官方密钥
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>添加官方密钥</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateOfficial} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="off-key">API 密钥</Label>
                                    <Input
                                        id="off-key"
                                        value={officialForm.key}
                                        onChange={(e) => setOfficialForm({ ...officialForm, key: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="off-active">启用</Label>
                                    <Switch
                                        id="off-active"
                                        checked={officialForm.is_active}
                                        onCheckedChange={(checked) => setOfficialForm({ ...officialForm, is_active: checked })}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">添加</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="bg-card border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4 font-medium">密钥</th>
                                <th className="p-4 font-medium">使用次数</th>
                                <th className="p-4 font-medium">状态</th>
                                <th className="p-4 font-medium text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {officialKeys.map((key) => (
                                <tr key={key.id} className="hover:bg-accent/50">
                                    <td className="p-4 font-mono max-w-[200px] truncate">{key.key}</td>
                                    <td className="p-4">{key.usage_count}</td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-xs",
                                            key.last_status === 'active' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                                key.last_status === '429' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                                                    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                        )}>
                                            {key.last_status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteOfficial(key.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
