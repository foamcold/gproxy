import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
                    <div className={cn("p-3 rounded text-sm", message.includes('success') ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">用户名</Label>
                        <Input id="username" value={user.username} disabled className="bg-muted" />
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

            <div className="bg-card border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">系统信息</h2>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">角色</span>
                        <span className="font-medium capitalize">{user.role}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">用户ID</span>
                        <span className="font-medium">{user.id}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { cn } from '@/lib/utils';