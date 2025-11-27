import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/api';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';


interface ExclusiveKey {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
}

export default function KeysPage() {
    const [exclusiveKeys, setExclusiveKeys] = useState<ExclusiveKey[]>([]);
    const [isExclusiveDialogOpen, setIsExclusiveDialogOpen] = useState(false);
    const [exclusiveForm, setExclusiveForm] = useState({ name: '', is_active: true });

    const fetchKeys = async () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const exclusiveRes = await axios.get(`${API_BASE_URL}/keys/exclusive`, { headers });
            setExclusiveKeys(exclusiveRes.data);
        } catch (error) {
            console.error('Failed to fetch keys', error);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);


    const handleCreateExclusive = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/keys/exclusive`, exclusiveForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsExclusiveDialogOpen(false);
            setExclusiveForm({ name: '', is_active: true });
            fetchKeys();
        } catch (error) {
            console.error('Failed to create exclusive key', error);
        }
    };


    const handleDeleteExclusive = async (id: number) => {
        if (!confirm('删除此专属密钥?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/keys/exclusive/${id}`, {
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

        </div>
    );
}
