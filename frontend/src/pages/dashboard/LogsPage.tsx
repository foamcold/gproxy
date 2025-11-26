import { useState, useEffect } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';

interface Log {
    id: number;
    model: string;
    status: string;
    status_code: number;
    latency: number;
    ttft: number;
    is_stream: boolean;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
    exclusive_key_key: string;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<Log[]>([]);

    const fetchLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/v1/logs/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(response.data);
        } catch (error) {
            console.error('Failed to fetch logs', error);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Auto refresh
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">请求日志</h1>

            <div className="bg-card border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4 font-medium whitespace-nowrap">时间</th>
                                <th className="p-4 font-medium whitespace-nowrap">密钥</th>
                                <th className="p-4 font-medium whitespace-nowrap">模型</th>
                                <th className="p-4 font-medium whitespace-nowrap">状态</th>
                                <th className="p-4 font-medium whitespace-nowrap">延迟</th>
                                <th className="p-4 font-medium whitespace-nowrap">首Token时间</th>
                                <th className="p-4 font-medium whitespace-nowrap">令牌 (输入/输出)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        未找到日志。
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-accent/50">
                                        <td className="p-4 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4 font-mono text-xs max-w-[150px] truncate" title={log.exclusive_key_key}>
                                            {log.exclusive_key_key ? log.exclusive_key_key.substring(0, 20) + '...' : '-'}
                                        </td>
                                        <td className="p-4">{log.model}</td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-xs",
                                                log.status === 'ok' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                                    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                            )}>
                                                {log.status_code || log.status}
                                            </span>
                                        </td>
                                        <td className="p-4">{log.latency.toFixed(2)}s</td>
                                        <td className="p-4">{log.ttft > 0 ? log.ttft.toFixed(2) + 's' : '-'}</td>
                                        <td className="p-4">
                                            {log.input_tokens} / {log.output_tokens}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
