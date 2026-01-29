'use client';

import React, { useState } from 'react';
import { Process } from '@/types/schedule';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, GripVertical, ArrowRight, Calendar } from 'lucide-react';

interface ProcessManagerProps {
  processes: Process[];
  onProcessesChange: (processes: Process[]) => void;
  taskDeadline?: Date;
  readOnly?: boolean;
}

export function ProcessManager({ processes, onProcessesChange, taskDeadline, readOnly = false }: ProcessManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessDescription, setNewProcessDescription] = useState('');
  const [newProcessDeadline, setNewProcessDeadline] = useState('');

  // 生成唯一ID
  const generateId = () => `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 添加新流程
  const handleAddProcess = () => {
    if (!newProcessName.trim()) return;

    const newProcess: Process = {
      id: generateId(),
      name: newProcessName.trim(),
      description: newProcessDescription.trim() || undefined,
      deadline: newProcessDeadline ? new Date(newProcessDeadline) : undefined
    };

    onProcessesChange([...(processes || []), newProcess]);

    // 重置表单
    setNewProcessName('');
    setNewProcessDescription('');
    setNewProcessDeadline('');
    setIsAddDialogOpen(false);
  };

  // 删除流程
  const handleDeleteProcess = (processId: string) => {
    onProcessesChange((processes || []).filter(p => p.id !== processId));
  };

  // 编辑流程
  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setNewProcessName(process.name);
    setNewProcessDescription(process.description || '');
    setNewProcessDeadline(process.deadline ? process.deadline.toISOString().split('T')[0] : '');
  };

  // 保存编辑的流程
  const handleSaveEdit = () => {
    if (!editingProcess || !newProcessName.trim()) return;

    const updatedProcesses = (processes || []).map(p =>
      p.id === editingProcess.id
        ? {
            ...p,
            name: newProcessName.trim(),
            description: newProcessDescription.trim() || undefined,
            deadline: newProcessDeadline ? new Date(newProcessDeadline) : undefined
          }
        : p
    );

    onProcessesChange(updatedProcesses);

    // 重置表单
    setEditingProcess(null);
    setNewProcessName('');
    setNewProcessDescription('');
    setNewProcessDeadline('');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingProcess(null);
    setNewProcessName('');
    setNewProcessDescription('');
    setNewProcessDeadline('');
  };

  // 格式化日期显示
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 检查流程截止日期是否超过任务总截止日期
  const isOverdue = (processDeadline?: Date) => {
    if (!processDeadline || !taskDeadline) return false;
    return processDeadline > taskDeadline;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">流程管理</CardTitle>
            <CardDescription>
              {(processes || []).length === 0 ? '暂无流程' : `共 ${processes.length} 个流程`}
            </CardDescription>
          </div>
          {!readOnly && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  新增流程
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增流程</DialogTitle>
                  <DialogDescription>
                    为任务添加新的流程节点
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="process-name">流程名称 *</Label>
                    <Input
                      id="process-name"
                      placeholder="例如：新片、修改、套框尺寸"
                      value={newProcessName}
                      onChange={(e) => setNewProcessName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="process-deadline">流程截止日期</Label>
                    <Input
                      id="process-deadline"
                      type="date"
                      value={newProcessDeadline}
                      onChange={(e) => setNewProcessDeadline(e.target.value)}
                      min={taskDeadline ? new Date(taskDeadline.getTime() + 86400000).toISOString().split('T')[0] : undefined}
                    />
                    {taskDeadline && (
                      <p className="text-xs text-slate-500">
                        任务总截止日期：{formatDate(taskDeadline)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="process-description">流程描述（可选）</Label>
                    <Textarea
                      id="process-description"
                      placeholder="描述该流程的具体要求和注意事项"
                      value={newProcessDescription}
                      onChange={(e) => setNewProcessDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddProcess}>
                    添加
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(processes || []).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {readOnly ? '该任务暂无流程' : '点击上方按钮添加流程'}
          </div>
        ) : (
          <div className="space-y-3">
            {processes.map((process, index) => (
              <div
                key={process.id}
                className="flex items-start gap-3 p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/50"
              >
                {/* 序号 */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  {index < processes.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                {/* 流程内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">{process.name}</h4>
                      {process.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {process.description}
                        </p>
                      )}
                      {process.deadline && (
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span className={isOverdue(process.deadline) ? 'text-red-600 font-medium' : 'text-slate-600'}>
                            截止日期：{formatDate(process.deadline)}
                          </span>
                          {isOverdue(process.deadline) && taskDeadline && (
                            <span className="text-red-600 ml-1">
                              （超过任务总截止日期 {formatDate(taskDeadline)}）
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProcess(process)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProcess(process.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* 任务总截止日期 */}
            {taskDeadline && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium">
                    总
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    任务总截止日期：<strong>{formatDate(taskDeadline)}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* 编辑流程对话框 */}
      <Dialog open={!!editingProcess} onOpenChange={handleCancelEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑流程</DialogTitle>
            <DialogDescription>
              修改流程信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-process-name">流程名称 *</Label>
              <Input
                id="edit-process-name"
                placeholder="例如：新片、修改、套框尺寸"
                value={newProcessName}
                onChange={(e) => setNewProcessName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-process-deadline">流程截止日期</Label>
              <Input
                id="edit-process-deadline"
                type="date"
                value={newProcessDeadline}
                onChange={(e) => setNewProcessDeadline(e.target.value)}
                min={taskDeadline ? new Date(taskDeadline.getTime() + 86400000).toISOString().split('T')[0] : undefined}
              />
              {taskDeadline && (
                <p className="text-xs text-slate-500">
                  任务总截止日期：{formatDate(taskDeadline)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-process-description">流程描述（可选）</Label>
              <Textarea
                id="edit-process-description"
                placeholder="描述该流程的具体要求和注意事项"
                value={newProcessDescription}
                onChange={(e) => setNewProcessDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
