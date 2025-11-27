import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import TurnstileWidget from '@/components/TurnstileWidget';
import { Mail, Lock, User, Key } from 'lucide-react';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [systemConfig, setSystemConfig] = useState<any>(null);
    const [countdown, setCountdown] = useState(0);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    // 加载系统配置
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await axios.get('/api/v1/system/config');
                setSystemConfig(response.data);
            } catch (error) {
                // 如果无法加载配置，使用默认值
                setSystemConfig({ enable_turnstile: false, require_email_verification: false });
            }
        };
        fetchConfig();
    }, []);

    // 发送验证码
    const handleSendCode = async () => {
        if (!email) {
            toast({
                variant: 'error',
                title: '请输入邮箱',
            });
            return;
        }

        try {
            await axios.post('/api/v1/auth/send-code', {
                email,
                type: 'register'
            });

            toast({
                variant: 'success',
                title: '验证码已发送',
                description: '请查收邮件，验证码5分钟内有效',
            });

            // 启动倒计时
            setCountdown(60);
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '发送失败',
                description: error.response?.data?.detail || '无法发送验证码',
            });
        }
    };

    // 验证验证码
    const verifyCode = async () => {
        try {
            await axios.post('/api/v1/auth/verify-code', {
                email,
                code: verificationCode,
                type: 'register'
            });
            return true;
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '验证失败',
                description: error.response?.data?.detail || '验证码无效或已过期',
            });
            return false;
        }
    };

    // 登录
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post('/api/v1/auth/login/access-token', formData);
            localStorage.setItem('token', response.data.access_token);

            toast({
                variant: 'success',
                title: '登录成功',
            });

            navigate('/dashboard');
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '登录失败',
                description: error.response?.data?.detail || '用户名或密码错误',
            });
        } finally {
            setLoading(false);
        }
    };

    // 注册
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Turnstile验证检查
            if (systemConfig?.enable_turnstile && !turnstileToken) {
                toast({
                    variant: 'error',
                    title: '请完成人机验证',
                });
                setLoading(false);
                return;
            }

            // 先验证验证码（如果有输入）
            if (verificationCode) {
                const isValid = await verifyCode();
                if (!isValid) {
                    setLoading(false);
                    return;
                }
            }

            // 注册用户
            const registerData: any = {
                username,
                email,
                password
            };

            // 添加Turnstile token（如果启用）
            if (systemConfig?.enable_turnstile && turnstileToken) {
                registerData.turnstile_token = turnstileToken;
            }

            await axios.post('/api/v1/users/open', registerData);

            toast({
                variant: 'success',
                title: '注册成功',
                description: '请使用用户名和密码登录',
            });

            // 切换到登录模式
            setIsLogin(true);
            setVerificationCode('');
            setTurnstileToken('');
        } catch (error: any) {
            toast({
                variant: 'error',
                title: '注册失败',
                description: error.response?.data?.detail || '注册失败，请重试',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
            <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* 标题区域 */}
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 text-center">
                    <h1 className="text-3xl font-bold mb-2">Gproxy</h1>
                    <p className="text-sm opacity-90">
                        {isLogin ? '欢迎回来' : '创建新账户'}
                    </p>
                </div>

                {/* 表单区域 */}
                <div className="p-8">
                    {/* 切换标签 */}
                    <div className="flex rounded-lg border p-1 mb-6">
                        <button
                            type="button"
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${isLogin
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            登录
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${!isLogin
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            注册
                        </button>
                    </div>

                    {/* 登录表单 */}
                    {isLogin ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="login-username">用户名</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="login-username"
                                        type="text"
                                        placeholder="输入用户名"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="login-password">密码</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="login-password"
                                        type="password"
                                        placeholder="输入密码"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? '登录中...' : '登录'}
                            </Button>
                        </form>
                    ) : (
                        /* 注册表单 */
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="register-username">用户名</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="register-username"
                                        type="text"
                                        placeholder="输入用户名"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="register-email">邮箱</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="register-email"
                                        type="email"
                                        placeholder="输入邮箱地址"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="register-code">验证码（可选）</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="register-code"
                                            type="text"
                                            placeholder="输入6位验证码"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            className="pl-10"
                                            maxLength={6}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleSendCode}
                                        disabled={countdown > 0 || !email}
                                        className="shrink-0"
                                    >
                                        {countdown > 0 ? `${countdown}s` : '发送'}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    如果系统启用邮箱验证，请先发送验证码
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="register-password">密码</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="register-password"
                                        type="password"
                                        placeholder="输入密码（至少6位）"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {/* Turnstile 人机验证 */}
                            {systemConfig?.enable_turnstile && systemConfig?.turnstile_site_key && (
                                <div className="space-y-2">
                                    <Label>人机验证</Label>
                                    <TurnstileWidget
                                        siteKey={systemConfig.turnstile_site_key}
                                        onVerify={(token) => setTurnstileToken(token)}
                                        onError={() => {
                                            toast({
                                                variant: 'error',
                                                title: '验证失败',
                                                description: '人机验证失败，请刷新重试',
                                            });
                                        }}
                                    />
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? '注册中...' : '注册'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
