import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Settings, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
    const isLoggedIn = !!localStorage.getItem('token');

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Navbar */}
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                            <Zap className="w-5 h-5" />
                        </div>
                        Gproxy
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com/foamcold/gproxy" target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary transition-colors">
                            GitHub
                        </a>
                        {isLoggedIn ? (
                            <Link to="/dashboard">
                                <Button>
                                    控制台
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/login">
                                <Button>登录</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1">
                <section className="py-20 lg:py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background pointer-events-none" />
                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
                            v1.0.0 现已发布
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 dark:to-purple-400">
                            终极 Gemini API 代理
                        </h1>
                        <p className="text-xl text-muted-foreground mb-10 max-w-[800px] mx-auto leading-relaxed">
                            释放 Gemini 的全部潜力，配备
                            <span className="text-foreground font-medium">预设管理</span>、
                            <span className="text-foreground font-medium">正则处理</span>和
                            <span className="text-foreground font-medium">密钥管理</span>等高级功能。
                            无缝兼容 OpenAI 格式。
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                            <Link to={isLoggedIn ? "/dashboard" : "/login"}>
                                <Button size="lg" className="w-full sm:w-auto text-lg px-8 h-12">
                                    {isLoggedIn ? '前往控制台' : '免费开始使用'}
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </Link>
                            <a href="#features">
                                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 h-12">
                                    了解更多
                                </Button>
                            </a>
                        </div>

                        {/* API Endpoint Card */}
                        <div className="bg-card border rounded-xl shadow-lg max-w-2xl mx-auto overflow-hidden text-left">
                            <div className="bg-muted px-4 py-3 border-b flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="ml-2 text-xs font-mono text-muted-foreground">api-endpoint</span>
                            </div>
                            <div className="p-6 font-mono text-sm space-y-4">
                                <div>
                                    <div className="text-muted-foreground mb-1">// OpenAI 兼容端点</div>
                                    <div className="bg-muted/50 p-3 rounded border flex items-center justify-between group">
                                        <code className="text-primary">{window.location.origin}/v1/chat/completions</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section id="features" className="py-20 bg-muted/30">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-center mb-12">强大功能</h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            <FeatureCard
                                icon={<Settings className="w-10 h-10 text-blue-500" />}
                                title="智能预设"
                                description="动态注入系统提示词并管理上下文模板。支持 {{roll}} 和 {{random}} 等变量替换。"
                            />
                            <FeatureCard
                                icon={<Terminal className="w-10 h-10 text-purple-500" />}
                                title="正则处理"
                                description="通过请求前和响应后的正则规则进行高级文本处理。自动清理数据或强制格式化。"
                            />
                            <FeatureCard
                                icon={<Shield className="w-10 h-10 text-green-500" />}
                                title="安全密钥管理"
                                description="管理官方密钥和专属密钥并跟踪使用情况。自动密钥轮换和状态轮询确保高可用性。"
                            />
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t py-8 bg-card">
                <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
                    <p>&copy; {new Date().getFullYear()} Gproxy。保留所有权利。</p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4 bg-accent/50 w-16 h-16 rounded-full flex items-center justify-center">
                {icon}
            </div>
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">
                {description}
            </p>
        </div>
    );
}
