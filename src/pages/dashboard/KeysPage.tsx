import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/api';
import { Plus, Trash2, Copy, RefreshCw, Activity, AlertCircle, Search, Pencil, Key as KeyIcon } from 'lucide-react';
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
import { confirm } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface ExclusiveKey {
    id: number;
    key: string;
    name: string;
    is_active: boolean;
    preset_id: number | null;
    enable_regex: boolean;
    created_at: string;
}

interface OfficialKey {
    id: number;
    key: string;
    is_active: boolean;
    usage_count: number;
    error_count: number;
    total_tokens: number;
    last_status: string;
    created_at: string;
}

interface Preset {
    id: number;
    name: string;
}

interface PaginatedResponse<T> {
    total: number;
    items: T[];
    page: number;
    size: number;
}

export default function KeysPage() {
    // Data State
    const [exclusiveData, setExclusiveData] = useState<PaginatedResponse<ExclusiveKey>>({ items: [], total: 0, page: 1, size: 10 });
    const [officialData, setOfficialData] = useState<PaginatedResponse<OfficialKey>>({ items: [], total: 0, page: 1, size: 10 });
    const [presets, setPresets] = useState<Preset[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [isExclusiveDialogOpen, setIsExclusiveDialogOpen] = useState(false);
    const [editingKey, setEditingKey] = useState<ExclusiveKey | null>(null);
    const [exclusiveForm, setExclusiveForm] = useState({
        name: '',
        is_active: true,
        preset_id: 'none',
        enable_regex: false
    });

    const [isOfficialDialogOpen, setIsOfficialDialogOpen] = useState(false);
    const [officialForm, setOfficialForm] = useState({ key: '', is_active: true });

    // Selection State
    const [selectedExclusiveIds, setSelectedExclusiveIds] = useState<Set<number>>(new Set());
    const [selectedOfficialIds, setSelectedOfficialIds] = useState<Set<number>>(new Set());

    const { toast } = useToast();

    // Fetch Data
    const fetchPresets = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<Preset[]>(`${API_BASE_URL}/presets/`, { headers: { Authorization: `Bearer ${token}` } });
            setPresets(res.data);
        } catch (error) {
            console.error('Failed to fetch presets', error);
        }
    }, []);

    const fetchExclusiveKeys = useCallback(async (page = exclusiveData.page, size = exclusiveData.size, query = searchQuery) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<PaginatedResponse<ExclusiveKey>>(`${API_BASE_URL}/keys/exclusive`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, size, q: query }
            });
            setExclusiveData(res.data);
            setSelectedExclusiveIds(new Set()); // Reset selection on page change
        } catch (error) {
            console.error('Failed to fetch exclusive keys', error);
            toast({ variant: 'error', title: '加载专属密钥失败' });
        }
    }, [exclusiveData.page, exclusiveData.size, searchQuery, toast]);

    const fetchOfficialKeys = useCallback(async (page = officialData.page, size = officialData.size) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get<PaginatedResponse<OfficialKey>>(`${API_BASE_URL}/keys/official`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, size }
            });
            setOfficialData(res.data);
            setSelectedOfficialIds(new Set()); // Reset selection on page change
        } catch (error) {
            console.error('Failed to fetch official keys', error);
            toast({ variant: 'error', title: '加载官方密钥失败' });
        }
    }, [officialData.page, officialData.size, toast]);

    useEffect(() => {
        fetchPresets();
        fetchExclusiveKeys(1, 10);
        fetchOfficialKeys(1, 10);
    }, []); // Initial load

    // Debounced search for exclusive keys
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchExclusiveKeys(1, exclusiveData.size, searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Selection Logic
    const handleSelectAll = (type: 'exclusive' | 'official') => {
        if (type === 'exclusive') {
            if (selectedExclusiveIds.size === exclusiveData.items.length) {
                setSelectedExclusiveIds(new Set());
            } else {
                setSelectedExclusiveIds(new Set(exclusiveData.items.map(k => k.id)));
            }
        } else {
            if (selectedOfficialIds.size === officialData.items.length) {
                setSelectedOfficialIds(new Set());
            } else {
                setSelectedOfficialIds(new Set(officialData.items.map(k => k.id)));
            }
        }
    };

    const handleSelectInverse = (type: 'exclusive' | 'official') => {
        if (type === 'exclusive') {
            const newSet = new Set<number>();
            exclusiveData.items.forEach(k => {
                if (!selectedExclusiveIds.has(k.id)) newSet.add(k.id);
            });
            setSelectedExclusiveIds(newSet);
        } else {
            const newSet = new Set<number>();
            officialData.items.forEach(k => {
                if (!selectedOfficialIds.has(k.id)) newSet.add(k.id);
            });
            setSelectedOfficialIds(newSet);
        }
    };

    const handleSelectOne = (type: 'exclusive' | 'official', id: number) => {
        if (type === 'exclusive') {
            const newSet = new Set(selectedExclusiveIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedExclusiveIds(newSet);
        } else {
            const newSet = new Set(selectedOfficialIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedOfficialIds(newSet);
        }
    };

    // Batch Operations
    const handleBatchAction = async (type: 'exclusive' | 'official', action: 'enable' | 'disable' | 'delete') => {
        const ids = type === 'exclusive' ? Array.from(selectedExclusiveIds) : Array.from(selectedOfficialIds);
        if (ids.length === 0) return;

        if (action === 'delete') {
            if (!await confirm({
                title: "批量删除",
                description: `确定要删除选中的 ${ids.length} 个密钥吗？此操作不可恢复。`,
                confirmText: "删除"
            })) return;
        }

        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        let successCount = 0;
        let failCount = 0;

        // Note: Ideally backend should support batch operations. For now, we loop.
        // To avoid UI freeze and too many requests, we can process in chunks or just Promise.all
        // For simplicity and better error handling in this context, we use Promise.allSettled

        const promises = ids.map(id => {
            const url = `${API_BASE_URL}/keys/${type}/${id}`;
            if (action === 'delete') {
                return axios.delete(url, { headers });
            } else {
                return axios.patch(url, { is_active: action === 'enable' }, { headers });
            }
        });

        const results = await Promise.allSettled(promises);

        results.forEach(res => {
            if (res.status === 'fulfilled') successCount++;
            else failCount++;
        });

        if (successCount > 0) {
            toast({ variant: 'success', title: `成功${action === 'delete' ? '删除' : (action === 'enable' ? '启用' : '禁用')} ${successCount} 个密钥` });
        }
        if (failCount > 0) {
            toast({ variant: 'error', title: `${failCount} 个密钥操作失败` });
        }

        if (type === 'exclusive') {
            fetchExclusiveKeys(exclusiveData.page, exclusiveData.size);
            setSelectedExclusiveIds(new Set());
        } else {
            fetchOfficialKeys(officialData.page, officialData.size);
            setSelectedOfficialIds(new Set());
        }
    };

    // Exclusive Key Actions
    const handleOpenExclusiveDialog = (key: ExclusiveKey | null = null) => {
        if (key) {
            setEditingKey(key);
            setExclusiveForm({
                name: key.name || '',
                is_active: key.is_active,
                preset_id: key.preset_id?.toString() || 'none',
                enable_regex: key.enable_regex || false
            });
        } else {
            setEditingKey(null);
            setExclusiveForm({
                name: '',
                is_active: true,
                preset_id: 'none',
                enable_regex: false
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
            enable_regex: exclusiveForm.enable_regex
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
            fetchExclusiveKeys(exclusiveData.page, exclusiveData.size);
        } catch (error) {
            toast({ variant: 'error', title: editingKey ? '更新失败' : '创建失败' });
        }
    };

    const handleDeleteExclusive = async (id: number) => {
        if (!await confirm({ title: "删除密钥", description: "确定要删除此专属密钥吗？", confirmText: "删除" })) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/keys/exclusive/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchExclusiveKeys(exclusiveData.page, exclusiveData.size);
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
            setOfficialForm({ key: '', is_active: true });
            fetchOfficialKeys(officialData.page, officialData.size);
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
            fetchOfficialKeys(officialData.page, officialData.size);
            toast({ variant: 'success', title: '状态已更新' });
        } catch (error) {
            toast({ variant: 'error', title: '更新失败' });
        }
    };

    const handleDeleteOfficial = async (id: number) => {
        if (!await confirm({ title: "删除密钥", description: `确定要删除此官方密钥吗？`, confirmText: "删除" })) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/keys/official/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchOfficialKeys(officialData.page, officialData.size);
            toast({ variant: 'success', title: '删除成功' });
        } catch (error) {
            toast({ variant: 'error', title: '删除失败' });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: '已复制到剪贴板' });
    };

    const getPresetName = (id: number | null) => presets.find(p => p.id === id)?.name || '-';

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">密钥管理</h1>
                <p className="text-muted-foreground">
                    管理您的专属密钥和官方 Gemini API 密钥
                </p>
            </div>

            <Tabs defaultValue="exclusive" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
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

                    <Card>
                        <CardContent className="p-0">
                            <div className="relative w-full">
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <th className="h-12 w-[50px] px-4 align-middle">
                                                <Checkbox
                                                    checked={exclusiveData.items.length > 0 && selectedExclusiveIds.size === exclusiveData.items.length}
                                                    onCheckedChange={() => handleSelectAll('exclusive')}
                                                />
                                            </th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">名称</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Key</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">绑定预设</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">启用正则</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">状态</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {exclusiveData.items.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <KeyIcon className="h-8 w-8 opacity-50" />
                                                        <p>没有找到密钥</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            exclusiveData.items.map((key) => (
                                                <tr key={key.id} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 align-middle">
                                                        <Checkbox
                                                            checked={selectedExclusiveIds.has(key.id)}
                                                            onCheckedChange={() => handleSelectOne('exclusive', key.id)}
                                                        />
                                                    </td>
                                                    <td className="p-4 align-middle font-medium">{key.name || '未命名'}</td>
                                                    <td className="p-4 align-middle">
                                                        <div className="flex items-center gap-2">
                                                            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm break-all" title={key.key}>
                                                                {key.key}
                                                            </code>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.key)}>
                                                                <Copy className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        {key.preset_id ? (
                                                            <Badge variant="outline">{getPresetName(key.preset_id)}</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <Badge variant={key.enable_regex ? "default" : "secondary"}>
                                                            {key.enable_regex ? "是" : "否"}
                                                        </Badge>
                                                    </td>
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
                        </CardContent>
                    </Card>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleSelectInverse('exclusive')}>
                                反选
                            </Button>
                            {selectedExclusiveIds.size > 0 ? (
                                <>
                                    <div className="h-4 w-[1px] bg-border mx-1" />
                                    <span className="text-sm text-muted-foreground">已选择 {selectedExclusiveIds.size} 项</span>
                                    <div className="h-4 w-[1px] bg-border mx-1" />
                                    <Button variant="ghost" size="sm" onClick={() => handleBatchAction('exclusive', 'enable')}>
                                        启用
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleBatchAction('exclusive', 'disable')}>
                                        禁用
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleBatchAction('exclusive', 'delete')}>
                                        删除
                                    </Button>
                                </>
                            ) : null}
                        </div>
                        <Pagination
                            currentPage={exclusiveData.page}
                            totalPages={Math.ceil(exclusiveData.total / exclusiveData.size)}
                            pageSize={exclusiveData.size}
                            totalItems={exclusiveData.total}
                            onPageChange={(page) => fetchExclusiveKeys(page, exclusiveData.size)}
                            onPageSizeChange={(size) => fetchExclusiveKeys(1, size)}
                        />
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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="ex-regex">启用正则</Label>
                                    <Switch
                                        id="ex-regex"
                                        checked={exclusiveForm.enable_regex}
                                        onCheckedChange={(checked) => setExclusiveForm({ ...exclusiveForm, enable_regex: checked })}
                                    />
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
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 border px-3 py-1 rounded-md text-sm h-10 bg-card">
                                <span className="text-muted-foreground">总密钥数</span>
                                <span className="font-bold">{officialData.total}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => fetchOfficialKeys(officialData.page, officialData.size)} variant="outline" className="h-10">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                刷新
                            </Button>
                            <Dialog open={isOfficialDialogOpen} onOpenChange={setIsOfficialDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="h-10">
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

                    <Card>
                        <CardContent className="p-0">
                            <div className="relative w-full">
                                <table className="w-full caption-bottom text-sm">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <th className="h-12 w-[50px] px-4 align-middle">
                                                <Checkbox
                                                    checked={officialData.items.length > 0 && selectedOfficialIds.size === officialData.items.length}
                                                    onCheckedChange={() => handleSelectAll('official')}
                                                />
                                            </th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Key</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">状态</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">请求/错误</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tokens</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">创建时间</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {officialData.items.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <AlertCircle className="h-8 w-8 opacity-50" />
                                                        <p>暂无官方密钥</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            officialData.items.map((key) => {
                                                let healthColor = 'text-green-600';
                                                let healthLabel = '正常';

                                                if (!key.is_active) {
                                                    healthColor = 'text-gray-500';
                                                    healthLabel = '已禁用';
                                                } else if (key.last_status && key.last_status !== 'active') {
                                                    healthColor = 'text-red-600';
                                                    healthLabel = key.last_status;
                                                }

                                                return (
                                                    <tr key={key.id} className="border-b transition-colors hover:bg-muted/50">
                                                        <td className="p-4 align-middle">
                                                            <Checkbox
                                                                checked={selectedOfficialIds.has(key.id)}
                                                                onCheckedChange={() => handleSelectOne('official', key.id)}
                                                            />
                                                        </td>
                                                        <td className="p-4 align-middle">
                                                            <div className="flex items-center gap-2">
                                                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm break-all" title={key.key}>
                                                                    {key.key}
                                                                </code>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(key.key)}>
                                                                    <Copy className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle">
                                                            <div className="flex items-center gap-2">
                                                                <Activity className={cn("w-4 h-4", healthColor)} />
                                                                <span className="text-sm">{healthLabel}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle">
                                                            <div className="flex items-center gap-1 text-sm">
                                                                <span>{key.usage_count || 0}</span>
                                                                <span className="text-muted-foreground">/</span>
                                                                <span className="text-red-600">{key.error_count || 0}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-sm">
                                                            {key.total_tokens || 0}
                                                        </td>
                                                        <td className="p-4 align-middle text-sm text-muted-foreground">
                                                            {new Date(key.created_at).toLocaleString('zh-CN', {
                                                                year: 'numeric',
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="p-4 align-middle text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Switch
                                                                    checked={key.is_active}
                                                                    onCheckedChange={(checked) => handleToggleOfficialActive(key.id, checked)}
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive h-8 w-8"
                                                                    onClick={() => handleDeleteOfficial(key.id)}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleSelectInverse('official')}>
                                反选
                            </Button>
                            {selectedOfficialIds.size > 0 ? (
                                <>
                                    <div className="h-4 w-[1px] bg-border mx-1" />
                                    <span className="text-sm text-muted-foreground">已选择 {selectedOfficialIds.size} 项</span>
                                    <div className="h-4 w-[1px] bg-border mx-1" />
                                    <Button variant="ghost" size="sm" onClick={() => handleBatchAction('official', 'enable')}>
                                        启用
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleBatchAction('official', 'disable')}>
                                        禁用
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleBatchAction('official', 'delete')}>
                                        删除
                                    </Button>
                                </>
                            ) : null}
                        </div>
                        <Pagination
                            currentPage={officialData.page}
                            totalPages={Math.ceil(officialData.total / officialData.size)}
                            pageSize={officialData.size}
                            totalItems={officialData.total}
                            onPageChange={(page) => fetchOfficialKeys(page, officialData.size)}
                            onPageSizeChange={(size) => fetchOfficialKeys(1, size)}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
