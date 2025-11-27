import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PresetItem } from '@/services/presetService';

interface PresetItemEditDialogProps {
    item: PresetItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (item: PresetItem) => void;
}

const roleOptions = [
    { value: 'system', label: '系统 (System)', icon: '🔧' },
    { value: 'user', label: '用户 (User)', icon: '👤' },
    { value: 'assistant', label: '助手 (Assistant)', icon: '🤖' },
];

const typeOptions = [
    { value: 'normal', label: '普通', description: '直接注入此条目' },
    { value: 'user_input', label: '用户输入', description: '插入最后一条用户消息' },
    { value: 'history', label: '历史', description: '插入历史对话（除最后一条用户消息）' },
];

export function PresetItemEditDialog({
    item,
    open,
    onOpenChange,
    onSave,
}: PresetItemEditDialogProps) {
    const [formData, setFormData] = useState<PresetItem>(item);

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">编辑预设条目</DialogTitle>
                    <DialogDescription>
                        配置预设条目的角色、类型和内容。支持使用变量如 {'{{'} roll 2d6 {'}}'}, {'{{'} random::A::B::C {'}}'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 条目名称 */}
                    <div className="space-y-2">
                        <Label htmlFor="name">条目名称</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="为此条目命名..."
                        />
                    </div>

                    {/* 角色选择 */}
                    <div className="space-y-2">
                        <Label>角色</Label>
                        <div className="grid grid-cols-3 gap-3">
                            {roleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: option.value as any })}
                                    className={`
                    flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                    ${formData.role === option.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/50'
                                        }
                  `}
                                >
                                    <span className="text-2xl">{option.icon}</span>
                                    <span className="text-sm font-medium">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 类型选择 */}
                    <div className="space-y-2">
                        <Label>类型</Label>
                        <div className="space-y-2">
                            {typeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: option.value as any })}
                                    className={`
                    w-full flex flex-col items-start gap-1 p-4 rounded-lg border-2 transition-all text-left
                    ${formData.type === option.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-primary/50'
                                        }
                  `}
                                >
                                    <span className="font-medium">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 内容编辑 */}
                    <div className="space-y-2">
                        <Label htmlFor="content">内容</Label>
                        <Textarea
                            id="content"
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="min-h-[200px] font-mono text-sm"
                            placeholder="输入条目内容，支持变量如 {{roll 2d6}}, {{random::A::B}}, {{#注释}}..."
                        />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>💡 <strong>可用变量：</strong></p>
                            <ul className="list-disc list-inside pl-2 space-y-0.5">
                                <li><code className="text-xs bg-muted px-1 rounded">{'{{'} roll XdY {'}}'}</code> - 投掷骰子，例如 {'{{'} roll 2d6 {'}}'}</li>
                                <li><code className="text-xs bg-muted px-1 rounded">{'{{'} random::A::B::C {'}}'}</code> - 随机选择</li>
                                <li><code className="text-xs bg-muted px-1 rounded">{'{{'} setvar::name::value {'}}'}</code> - 设置变量</li>
                                <li><code className="text-xs bg-muted px-1 rounded">{'{{'} getvar::name {'}}'}</code> - 获取变量</li>
                                <li><code className="text-xs bg-muted px-1 rounded">{'{{'} #注释 {'}}'}</code> - 添加注释（将被移除）</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
