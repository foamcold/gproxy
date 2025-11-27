import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    FileJson,
    Regex,
    Key,
    ScrollText,
    Settings,
    Users,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: '概览', path: '/dashboard' },
        { icon: FileJson, label: '预设', path: '/dashboard/presets' },
        { icon: Regex, label: '正则', path: '/dashboard/regex' },
        { icon: Key, label: '密钥', path: '/dashboard/keys' },
        { icon: Key, label: '轮询', path: '/dashboard/official-keys', adminOnly: true },
        { icon: ScrollText, label: '日志', path: '/dashboard/logs' },
        { icon: Settings, label: '设置', path: '/dashboard/settings' },
        { icon: Users, label: '用户', path: '/dashboard/users', adminOnly: true },
        { icon: Settings, label: '系统', path: '/dashboard/system', adminOnly: true },
    ];

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
                    !isSidebarOpen && "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    <div className="h-16 flex items-center px-6 border-b">
                        <span className="text-xl font-bold">Gproxy</span>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    location.pathname === item.path
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 border-t">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            退出登录
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 flex items-center px-4 border-b bg-card lg:hidden">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-md hover:bg-accent"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
