import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { API_BASE_URL } from '@/utils/api';
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
import { Search, UserPlus, Ban, Trash2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { confirm } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/pagination';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

interface PaginatedResponse<T> {
    total: number;
    items: T[];
    page: number;
    size: number;
}

export default function AdminUsersPage() {
    const [userData, setUserData] = useState<PaginatedResponse<User>>({ items: [], total: 0, page: 1, size: 10 });
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({ username: '', email: '', password: '', role: 'user', is_active: true });
    const { toast } = useToast();

    const fetchUsers = useCallback(async (page = 1, size = 10, query = '') => {
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get<PaginatedResponse<User>>(`${API_BASE_URL}/users/`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page, size, q: query }
            });
            setUserData(response.data);
        } catch (error) {
            toast({
                variant: 'error',
                title: '加载失败',
                description: '无法加载用户列表',
            });
        }
    }, [toast]);

    useEffect(() => {
        fetchUsers(1, 10, searchQuery);
    }, [fetchUsers, searchQuery]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/users/create`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsDialogOpen(false);
            setFormData({ username: '', email: '', password: '', role: 'user', is_active: true });
            fetchUsers(userData.page, userData.size, searchQuery);
            toast({
                variant: 'success',
                title: '创建成功',
            });
        } catch (error) {
            toast({
                variant: 'error',
                title: '创建失败',
            });
        }
    };

    const handleToggleActive = async (user: User) => {
        if (user.is_active) {
            if (!await confirm({
                title: "禁用用户",
                description: `确定要禁用用户 "${user.username}" 吗？禁用后该用户将无法登录。`,
                confirmText: "禁用",
                cancelText: "取消"
            })) return;
        }

        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_BASE_URL}/users/${user.id}/toggle-active`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers(userData.page, userData.size, searchQuery);
            toast({
                variant: 'success',
                title: '状态已更新',
            });
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '操作失败',
                description: error.response?.data?.detail || '无法更新用户状态',
            });
        }
    };

    const handleDelete = async (userId: number, username: string) => {
        if (!await confirm({ title: "注销用户", description: `确定要注销用户 "${username}" 吗？此操作会将用户设置为不活跃状态。`, confirmText: "注销" })) return;

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`${API_BASE_URL}/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers(userData.page, userData.size, searchQuery);
            toast({
                variant: 'success',
                title: '用户已注销',
            });
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '注销失败',
                description: error.response?.data?.detail || '无法注销用户',
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">用户</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理系统用户权限和账号状态
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="w-4 h-4 mr-2" />
                            添加用户
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>创建新用户</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">用户名</Label>
                                <Input
                                    id="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">邮箱</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">密码</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">权限</Label>
                                <select
                                    id="role"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="user">用户</option>
                                    <option value="admin">管理员</option>
                                </select>
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
                                <Button type="submit">创建</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* 搜索栏 */}
            <div className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="按 ID 或用户名搜索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* 用户表格 */}
            <div className="bg-card border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="p-4 font-medium">ID</th>
                            <th className="p-4 font-medium">用户名</th>
                            <th className="p-4 font-medium">邮箱</th>
                            <th className="p-4 font-medium">权限</th>
                            <th className="p-4 font-medium">状态</th>
                            <th className="p-4 font-medium">创建时间</th>
                            <th className="p-4 font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {userData.items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                    {searchQuery ? '未找到匹配的用户' : '暂无用户'}
                                </td>
                            </tr>
                        ) : (
                            userData.items.map((user) => (
                                <tr key={user.id} className="hover:bg-accent/50">
                                    <td className="p-4">{user.id}</td>
                                    <td className="p-4 font-medium">{user.username}</td>
                                    <td className="p-4">{user.email}</td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-xs font-medium",
                                            user.role === 'admin'
                                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-100"
                                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
                                        )}>
                                            {user.role === 'admin' ? '管理员' : '用户'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded text-xs font-medium",
                                            user.is_active
                                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-100"
                                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100"
                                        )}>
                                            {user.is_active ? '启用' : '禁用'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-muted-foreground">
                                        {format(toZonedTime(new Date(user.created_at), 'Asia/Shanghai'), 'yyyy-MM-dd HH:mm:ss')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleToggleActive(user)}
                                                title={user.is_active ? '禁用用户' : '启用用户'}
                                            >
                                                {user.is_active ? (
                                                    <Ban className="w-4 h-4 text-orange-600" />
                                                ) : (
                                                    <UserCheck className="w-4 h-4 text-green-600" />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={userData.page}
                totalPages={Math.ceil(userData.total / userData.size)}
                pageSize={userData.size}
                totalItems={userData.total}
                onPageChange={(page) => fetchUsers(page, userData.size, searchQuery)}
                onPageSizeChange={(size) => fetchUsers(1, size, searchQuery)}
            />
        </div>
    );
}
