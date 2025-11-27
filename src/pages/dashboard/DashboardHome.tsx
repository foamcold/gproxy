export default function DashboardHome() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">概览</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-6 bg-card border rounded-lg shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">总请求数</h3>
                    <div className="text-2xl font-bold mt-2">1,234</div>
                </div>
                <div className="p-6 bg-card border rounded-lg shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">活跃密钥</h3>
                    <div className="text-2xl font-bold mt-2">5</div>
                </div>
                <div className="p-6 bg-card border rounded-lg shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">总令牌数</h3>
                    <div className="text-2xl font-bold mt-2">1.2M</div>
                </div>
                <div className="p-6 bg-card border rounded-lg shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground">平均延迟</h3>
                    <div className="text-2xl font-bold mt-2">450ms</div>
                </div>
            </div>

            <div className="bg-card border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">最近活动</h2>
                <div className="text-muted-foreground text-sm">
                    暂无最近活动。
                </div>
            </div>
        </div>
    );
}
