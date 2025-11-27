import { useState, useEffect } from 'react';
import axios from 'axios';
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
import { useToast } from '@/hooks/useToast';
import { Plus, RefreshCw, Trash2, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfficialKey {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
    total_requests: number;
    failed_requests: number;
    last_used_at: string | null;
    created_at: string;
}

export default function OfficialKeysPage() {
    const [keys, setKeys] = useState<OfficialKey[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', key: '', is_active: true });
    const { toast } = useToast();

    const fetchKeys = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get<OfficialKey[]>('/api/v1/keys/official', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setKeys(response.data);
        } catch (error) {
            toast({
                variant: 'error',
                title: '加载失败',
                description: '无法加载官方密钥列表',
            });
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('/api/v1/keys/official', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsDialogOpen(false);
            setFormData({ name: '', key: '', is_active: true });
            fetchKeys();
            toast({
                variant: 'success',
                title: '添加成功',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '添加失败',
            });
        }
    };

    const handleToggleActive = async (id: number, isActive: boolean) => {
        const token = localStorage.getItem('token');
        try {
            await axios.patch(`/api/v1/keys/official/${id}`,
                { is_active: isActive },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchKeys();
            toast({
                variant: 'success',
                title: '状态已更新',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '更新失败',
            });
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`确定要删除密钥 "${name}" 吗？`)) return;

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`/api/v1/keys/official/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchKeys();
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

    const calculateSuccessRate = (key: OfficialKey): string => {
        if (key.total_requests === 0) return '0';
        return ((key.total_requests - key.failed_requests) / key.total_requests * 100).toFixed(1);
    };

    const getHealthStatus = (key: OfficialKey) => {
        const successRate = parseFloat(calculateSuccessRate(key));
        if (!key.is_active) return { label: '已禁用', color: 'text-gray-500' };
        if (successRate >= 95) return { label: '健康', color: 'text-green-600' };
        if (successRate >= 80) return { label: '良好', color: 'text-blue-600' };
        if (successRate >= 60) return { label: '一般', color: 'text-yellow-600' };
        return { label: '异常', color: 'text-red-600' };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">官方密钥管理</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理 Gemini 官方 API 密钥，系统将自动轮询使用
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchKeys} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        刷新
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                添加密钥
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>添加官方密钥</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">名称</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="为密钥命名，方便识别"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="key">API Key</Label>
                                    <Input
                                        id="key"
                                        type="password"
                                        value={formData.key}
                                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                                        placeholder="AIza..."
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
                                    <Button type="submit">添加</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">总密钥数</div>
                    <div className="text-2xl font-bold mt-1">{keys.length}</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">活跃密钥</div>
                    <div className="text-2xl font-bold mt-1 text-green-600">
                        {keys.filter(k => k.is_active).length}
                    </div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">总请求数</div>
                    <div className="text-2xl font-bold mt-1">
                        {keys.reduce((sum, k) => sum + k.total_requests, 0)}
                    </div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">失败请求</div>
                    <div className="text-2xl font-bold mt-1 text-red-600">
                        {keys.reduce((sum, k) => sum + k.failed_requests, 0)}
                    </div>
                </div>
            </div>

            {/* 密钥列表 */}
            <div className="bg-card border rounded-lg overflow-hidden">
                {keys.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无官方密钥</p>
                        <p className="text-xs mt-1">点击"添加密钥"开始添加</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {keys.map((key) => {
                            const health = getHealthStatus(key);
                            return (
                                <div key={key.id} className="p-4 hover:bg-accent/50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-medium">{key.name}</span>
                                                <span className={cn("text-xs flex items-center gap-1", health.color)}>
                                                    <Activity className="w-3 h-3" />
                                                    {health.label}
                                                </span>
                                                {!key.is_active && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                                        已禁用
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground mb-3">
                                                {key.key.substring(0, 20)}...
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">总请求</div>
                                                    <div className="font-medium">{key.total_requests}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">失败</div>
                                                    <div className="font-medium text-red-600">{key.failed_requests}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">成功率</div>
                                                    <div className="font-medium">{calculateSuccessRate(key)}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">最后使用</div>
                                                    <div className="font-medium">
                                                        {key.last_used_at
                                                            ? new Date(key.last_used_at).toLocaleString('zh-CN', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })
                                                            : '从未使用'
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                            <Switch
                                                checked={key.is_active}
                                                onCheckedChange={(checked) => handleToggleActive(key.id, checked)}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(key.id, key.name)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
