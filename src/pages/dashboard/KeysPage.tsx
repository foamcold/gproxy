import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/api';
import { Plus, Trash2, Copy, RefreshCw, Activity, AlertCircle, Search, Pencil, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface ExclusiveKey {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
    preset_id: number | null;
    regex_id: number | null;
}

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

interface Preset {
    id: number;
    name: string;
}

interface RegexRule {
    id: number;
    name: string;
}

export default function KeysPage() {
    // Data State
    const [exclusiveKeys, setExclusiveKeys] = useState<ExclusiveKey[]>([]);
    const [officialKeys, setOfficialKeys] = useState<OfficialKey[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [regexRules, setRegexRules] = useState<RegexRule[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [isExclusiveDialogOpen, setIsExclusiveDialogOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<ExclusiveKey | null>(null);
    const [exclusiveForm, setExclusiveForm] = useState({
        name: '',
        is_active: true,
        preset_id: 'none',
        regex_id: 'none'
    });

    const [isOfficialDialogOpen, setIsOfficialDialogOpen] = useState(false);
    const [officialForm, setOfficialForm] = useState({ name: '', key: '', is_active: true });

    const { toast } = useToast();

    // Fetch Data
    const fetchData = async () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [exRes, offRes, preRes, regRes] = await Promise.all([
                axios.get<ExclusiveKey[]>(`${API_BASE_URL}/keys/exclusive`, { headers }),
                axios.get<OfficialKey[]>(`${API_BASE_URL}/keys/official`, { headers }),
                axios.get<Preset[]>(`${API_BASE_URL}/presets/`, { headers }),
                axios.get<RegexRule[]>(`${API_BASE_URL}/regex/`, { headers })
            ]);

            setExclusiveKeys(exRes.data);
            setOfficialKeys(offRes.data);
            setPresets(preRes.data);
            setRegexRules(regRes.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast({ variant: 'error', title: '加载数据失败' });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Exclusive Key Actions
    const handleOpenExclusiveDialog = (key: ExclusiveKey | null = null) => {
        if (key) {
            setEditingKey(key);
            setExclusiveForm({
                name: key.name || '',
                is_active: key.is_active,
                preset_id: key.preset_id?.toString() || 'none',
                regex_id: key.regex_id?.toString() || 'none'
            });
        } else {
            setEditingKey(null);
            setExclusiveForm({
                name: '',
                is_active: true,
                preset_id: 'none',
                regex_id: 'none'
            });
        }
        setIsExclusiveDialogOpen(true);
    };

    const handleSaveExclusive = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const payload = {
            name: exclusiveForm.name,
            is_active: exclusiveForm.is_active,
            preset_id: exclusiveForm.preset_id === 'none' ? null : parseInt(exclusiveForm.preset_id),
            regex_id: exclusiveForm.regex_id === 'none' ? null : parseInt(exclusiveForm.regex_id)
        };

        try {
            if (editingKey) {
                await axios.patch(`${API_BASE_URL}/keys/exclusive/${editingKey.id}`, payload, { headers });
                toast({ variant: 'success', title: '更新成功' });
            } else {
                await axios.post(`${API_BASE_URL}/keys/exclusive`, payload, { headers });
                toast({ variant: 'success', title: '创建成功' });
            }
            setIsExclusiveDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({ variant: 'error', title: editingKey ? '更新失败' : '创建失败' });
        }
    };

    const handleDeleteExclusive = async (id: number) => {
        if (!confirm('删除此专属密钥?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/keys/exclusive/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
            toast({ variant: 'success', title: '删除成功' });
        } catch (error) {
            toast({ variant: 'error', title: '删除失败' });
        }
    };

    // Official Key Actions
    const handleCreateOfficial = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/keys/official`, officialForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsOfficialDialogOpen(false);
            setOfficialForm({ name: '', key: '', is_active: true });
            fetchData();
            toast({ variant: 'success', title: '添加成功' });
        } catch (error) {
            toast({ variant: 'error', title: '添加失败' });
        }
    };

    const handleToggleOfficialActive = async (id: number, isActive: boolean) => {
        const token = localStorage.getItem('token');
        try {
            await axios.patch(`${API_BASE_URL}/keys/official/${id}`,
                { is_active: isActive },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchData();
            toast({ variant: 'success', title: '状态已更新' });
        } catch (error) {
            toast({ variant: 'error', title: '更新失败' });
        }
    };

    const handleDeleteOfficial = async (id: number, name: string) => {
        if (!confirm(`确定要删除密钥 "${name}" 吗？`)) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/keys/official/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
            toast({ variant: 'success', title: '删除成功' });
        } catch (error) {
            toast({ variant: 'error', title: '删除失败' });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: '已复制到剪贴板' });
    };

    // Helpers
    const filteredExclusiveKeys = exclusiveKeys.filter(key =>
        key.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.key.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getPresetName = (id: number | null) => presets.find(p => p.id === id)?.name || '-';
    const getRegexName = (id: number | null) => regexRules.find(r => r.id === id)?.name || '-';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">密钥管理</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    管理您的专属密钥和官方 Gemini API 密钥
                </p>
            </div>

            <Tabs defaultValue="exclusive" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="exclusive">专属密钥</TabsTrigger>
                    <TabsTrigger value="official">官方密钥</TabsTrigger>
                </TabsList>

                {/* Exclusive Keys Tab */}
                <TabsContent value="exclusive" className="space-y-4">
                    <div className="flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索密钥名称或 Key..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => handleOpenExclusiveDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            生成密钥
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">名称</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Key</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">绑定预设</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">绑定正则</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">状态</th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredExclusiveKeys.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                                没有找到密钥
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredExclusiveKeys.map((key) => (
                                            <tr key={key.id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle font-medium">{key.name || '未命名'}</td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
                                                            {key.key.substring(0, 12)}...
                                                        </code>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.key)}>
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">{getPresetName(key.preset_id)}</td>
                                                <td className="p-4 align-middle">{getRegexName(key.regex_id)}</td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", key.is_active ? "bg-green-500" : "bg-red-500")} />
                                                        {key.is_active ? "启用" : "禁用"}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenExclusiveDialog(key)}>
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteExclusive(key.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Dialog open={isExclusiveDialogOpen} onOpenChange={setIsExclusiveDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingKey ? '编辑专属密钥' : '生成专属密钥'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSaveExclusive} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ex-name">名称 (可选)</Label>
                                    <Input
                                        id="ex-name"
                                        value={exclusiveForm.name}
                                        onChange={(e) => setExclusiveForm({ ...exclusiveForm, name: e.target.value })}
                                        placeholder="My App Key"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>绑定预设</Label>
                                    <Select
                                        value={exclusiveForm.preset_id}
                                        onValueChange={(val) => setExclusiveForm({ ...exclusiveForm, preset_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择预设..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">不使用预设</SelectItem>
                                            {presets.map(p => (
                                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>绑定正则</Label>
                                    <Select
                                        value={exclusiveForm.regex_id}
                                        onValueChange={(val) => setExclusiveForm({ ...exclusiveForm, regex_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择正则..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">不使用正则</SelectItem>
                                            {regexRules.map(r => (
                                                <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="ex-active">启用</Label>
                                    <Switch
                                        id="ex-active"
                                        checked={exclusiveForm.is_active}
                                        onCheckedChange={(checked) => setExclusiveForm({ ...exclusiveForm, is_active: checked })}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">{editingKey ? '保存' : '生成'}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* Official Keys Tab */}
                <TabsContent value="official" className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">官方密钥管理</h2>
                            <p className="text-muted-foreground">
                                管理 Gemini 官方 API 密钥，系统将自动轮询使用
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={fetchData} variant="outline" size="sm">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                刷新
                            </Button>
                            <Dialog open={isOfficialDialogOpen} onOpenChange={setIsOfficialDialogOpen}>
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
                                    <form onSubmit={handleCreateOfficial} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">名称</Label>
                                            <Input
                                                id="name"
                                                value={officialForm.name}
                                                onChange={(e) => setOfficialForm({ ...officialForm, name: e.target.value })}
                                                placeholder="为密钥命名，方便识别"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="key">API Key</Label>
                                            <Input
                                                id="key"
                                                type="password"
                                                value={officialForm.key}
                                                onChange={(e) => setOfficialForm({ ...officialForm, key: e.target.value })}
                                                placeholder="AIza..."
                                                required
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="active">启用</Label>
                                            <Switch
                                                id="active"
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
                    </div>

                    {/* 统计卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-card border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">总密钥数</div>
                            <div className="text-2xl font-bold mt-1">{officialKeys.length}</div>
                        </div>
                        <div className="bg-card border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">活跃密钥</div>
                            <div className="text-2xl font-bold mt-1 text-green-600">
                                {officialKeys.filter(k => k.is_active).length}
                            </div>
                        </div>
                        <div className="bg-card border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">总请求数</div>
                            <div className="text-2xl font-bold mt-1">
                                {officialKeys.reduce((sum, k) => sum + k.total_requests, 0)}
                            </div>
                        </div>
                        <div className="bg-card border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">失败请求</div>
                            <div className="text-2xl font-bold mt-1 text-red-600">
                                {officialKeys.reduce((sum, k) => sum + k.failed_requests, 0)}
                            </div>
                        </div>
                    </div>

                    {/* 密钥列表 */}
                    <div className="bg-card border rounded-lg overflow-hidden">
                        {officialKeys.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">暂无官方密钥</p>
                                <p className="text-xs mt-1">点击"添加密钥"开始添加</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {officialKeys.map((key) => {
                                    const successRate = key.total_requests === 0 ? 0 : ((key.total_requests - key.failed_requests) / key.total_requests * 100);
                                    let healthColor = 'text-red-600';
                                    let healthLabel = '异常';
                                    if (!key.is_active) {
                                        healthColor = 'text-gray-500';
                                        healthLabel = '已禁用';
                                    } else if (successRate >= 95) {
                                        healthColor = 'text-green-600';
                                        healthLabel = '健康';
                                    } else if (successRate >= 80) {
                                        healthColor = 'text-blue-600';
                                        healthLabel = '良好';
                                    } else if (successRate >= 60) {
                                        healthColor = 'text-yellow-600';
                                        healthLabel = '一般';
                                    }

                                    return (
                                        <div key={key.id} className="p-4 hover:bg-accent/50 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-medium">{key.name}</span>
                                                        <span className={cn("text-xs flex items-center gap-1", healthColor)}>
                                                            <Activity className="w-3 h-3" />
                                                            {healthLabel}
                                                        </span>
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
                                                            <div className="font-medium">{successRate.toFixed(1)}%</div>
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
                                                        onCheckedChange={(checked) => handleToggleOfficialActive(key.id, checked)}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteOfficial(key.id, key.name)}
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
                </TabsContent>
            </Tabs>
        </div>
    );
}
