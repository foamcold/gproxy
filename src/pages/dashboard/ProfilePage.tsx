import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await axios.get(`${API_BASE_URL}/users/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(response.data);
                setEmail(response.data.email);
            } catch (error) {
                console.error('Failed to fetch user', error);
            }
        };
        fetchUser();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_BASE_URL}/users/me`,
                { email, password: password || undefined },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage('资料已成功更新');
            setPassword('');
        } catch (error) {
            setMessage('更新资料失败');
        }
    };

    // 将角色转换为中文
    const getRoleDisplayName = (role: string) => {
        const roleMap: Record<string, string> = {
            'user': '用户',
            'admin': '管理员',
            'super_admin': '超级管理员'
        };
        return roleMap[role] || role;
    };

    if (!user) return <div>加载中...</div>;

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">资料</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    配置系统参数和个性化选项
                </p>
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-semibold">资料设置</h2>

                {message && (
                    <div className={cn("p-3 rounded text-sm", message.includes('成功') ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">用户名</Label>
                        <Input id="username" value={user.username} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="user-id">用户ID</Label>
                        <Input id="user-id" value={user.id} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="user-role">用户权限</Label>
                        <Input id="user-role" value={getRoleDisplayName(user.role)} disabled className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">邮箱</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">新密码 (保留空白以保持当前密码)</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <Button type="submit">更新资料</Button>
                </form>
            </div>
        </div>
    );
}