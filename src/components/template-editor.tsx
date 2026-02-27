'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowUp, ArrowDown, Edit2 } from 'lucide-react';
import { ProjectTemplate, TemplateTask, ResourceWorkType } from '@/types/schedule';

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ProjectTemplate;
  onSave: (template: ProjectTemplate) => void;
}

export default function TemplateEditor({ open, onOpenChange, template, onSave }: TemplateEditorProps) {
  const [formData, setFormData] = useState<Partial<ProjectTemplate>>(
    template || {
      id: '',
      name: '',
      description: '',
      category: '自定义',
      tasks: [],
      color: '#64748b',
      isDefault: false
    }
  );

  const [editingCell, setEditingCell] = useState<{ taskId: string; field: string } | null>(null);

  // 当打开编辑器或 template 变化时，同步数据
  useEffect(() => {
    if (open) {
      if (template) {
        setFormData(template);
      } else {
        setFormData({
          id: '',
          name: '',
          description: '',
          category: '自定义',
          tasks: [],
          color: '#64748b',
          isDefault: false
        });
      }
    }
  }, [open, template]);

  const [newTask, setNewTask] = useState<Partial<TemplateTask>>({
    id: '',
    sequence: 1,
    name: '',
    description: '',
    estimatedHours: 8,
    priority: 'normal',
    taskType: '平面',
    dependencies: [],
    allowParallel: false,
    notes: ''
  });

  const handleAddTask = () => {
    if (!newTask.name) {
      alert('请输入任务名称');
      return;
    }

    const task: TemplateTask = {
      id: `task-${Date.now()}`,
      sequence: formData.tasks?.length || 0,
      name: newTask.name || '',
      description: newTask.description,
      estimatedHours: newTask.estimatedHours || 8,
      priority: newTask.priority || 'normal',
      taskType: newTask.taskType || '平面',
      dependencies: newTask.dependencies || [],
      allowParallel: newTask.allowParallel || false,
      notes: newTask.notes
    };

    setFormData({
      ...formData,
      tasks: [...(formData.tasks || []), task]
    });

    // 重置新任务表单
    setNewTask({
      id: '',
      sequence: (formData.tasks?.length || 0) + 1,
      name: '',
      description: '',
      estimatedHours: 8,
      priority: 'normal',
      taskType: '平面',
      dependencies: [],
      allowParallel: false,
      notes: ''
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setFormData({
      ...formData,
      tasks: formData.tasks?.filter(t => t.id !== taskId) || []
    });
  };

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    const tasks = [...(formData.tasks || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= tasks.length) return;

    // 交换位置
    [tasks[index], tasks[newIndex]] = [tasks[newIndex], tasks[index]];

    // 更新序号
    tasks.forEach((task, idx) => {
      task.sequence = idx + 1;
    });

    setFormData({ ...formData, tasks });
  };

  const handleSave = () => {
    if (!formData.name || !formData.category) {
      alert('请填写模板名称和分类');
      return;
    }

    if (!formData.tasks || formData.tasks.length === 0) {
      alert('请至少添加一个任务');
      return;
    }

    const templateToSave: ProjectTemplate = {
      id: formData.id || `template-${Date.now()}`,
      name: formData.name,
      description: formData.description || '',
      category: formData.category,
      tasks: formData.tasks,
      color: formData.color || '#64748b',
      isDefault: formData.isDefault || false,
      createdAt: formData.createdAt || new Date(),
      updatedAt: new Date()
    };

    onSave(templateToSave);
    onOpenChange(false);
  };

  const totalHours = formData.tasks?.reduce((sum, t) => sum + t.estimatedHours, 0) || 0;
  const availableSequences = formData.tasks?.map(t => t.sequence) || [];

  const getTaskBySequence = (sequence: number) => {
    return formData.tasks?.find(t => t.sequence === sequence);
  };

  const handleUpdateTaskField = (taskId: string, field: keyof TemplateTask, value: any) => {
    setFormData({
      ...formData,
      tasks: formData.tasks?.map(t => 
        t.id === taskId 
          ? { ...t, [field]: value }
          : t
      ) || []
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {template ? '编辑项目模板' : '新建项目模板'}
          </DialogTitle>
          <DialogDescription>
            配置项目流程模板，定义任务列表和依赖关系
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 左侧：基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>模板基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="templateName">模板名称 *</Label>
                  <Input
                    id="templateName"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：买量片项目"
                  />
                </div>
                <div>
                  <Label htmlFor="templateCategory">模板分类 *</Label>
                  <Input
                    id="templateCategory"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="例如：买量片、宣传片、广告片"
                  />
                </div>
                <div>
                  <Label htmlFor="templateDescription">模板描述</Label>
                  <Input
                    id="templateDescription"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="描述该模板的用途和特点"
                  />
                </div>
                <div>
                  <Label htmlFor="templateColor">模板颜色</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="templateColor"
                      type="color"
                      value={formData.color || '#64748b'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <span className="text-sm text-slate-500">{formData.color || '#64748b'}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">任务总数：</span>
                      <span className="font-semibold ml-1">{formData.tasks?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">总工时：</span>
                      <span className="font-semibold ml-1">{totalHours}h</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 右侧：添加任务 */}
            <Card>
              <CardHeader>
                <CardTitle>添加任务</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="taskName">任务名称 *</Label>
                  <Input
                    id="taskName"
                    value={newTask.name || ''}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    placeholder="例如：创意策划"
                  />
                </div>
                <div>
                  <Label htmlFor="taskDescription">任务描述</Label>
                  <Input
                    id="taskDescription"
                    value={newTask.description || ''}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="简要描述任务内容"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="taskHours">预估工时（小时）*</Label>
                    <Input
                      id="taskHours"
                      type="number"
                      min="1"
                      value={newTask.estimatedHours || 8}
                      onChange={(e) => setNewTask({ ...newTask, estimatedHours: parseFloat(e.target.value) || 8 })}
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <Label htmlFor="taskPriority">优先级</Label>
                    <Select value={newTask.priority || 'normal'} onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}>
                      <SelectTrigger id="taskPriority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">紧急</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="normal">普通</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="taskType">任务类型</Label>
                    <Select value={newTask.taskType || '平面'} onValueChange={(value: ResourceWorkType) => setNewTask({ ...newTask, taskType: value })}>
                      <SelectTrigger id="taskType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="平面">平面</SelectItem>
                        <SelectItem value="后期">后期</SelectItem>
                        <SelectItem value="物料">物料</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="allowParallel"
                      checked={newTask.allowParallel || false}
                      onChange={(e) => setNewTask({ ...newTask, allowParallel: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="allowParallel" className="cursor-pointer">允许并行</Label>
                  </div>
                </div>
                {availableSequences.length > 0 && (
                  <div>
                    <Label>依赖任务（可选）</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {availableSequences.map(seq => {
                        const task = getTaskBySequence(seq);
                        const taskName = task?.name || `任务 ${seq}`;
                        return (
                          <label key={seq} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newTask.dependencies?.includes(seq)}
                              onChange={(e) => {
                                const deps = newTask.dependencies || [];
                                if (e.target.checked) {
                                  setNewTask({ ...newTask, dependencies: [...deps, seq] });
                                } else {
                                  setNewTask({ ...newTask, dependencies: deps.filter(d => d !== seq) });
                                }
                              }}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{taskName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="taskNotes">任务说明</Label>
                  <Input
                    id="taskNotes"
                    value={newTask.notes || ''}
                    onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                    placeholder="补充说明（可选）"
                  />
                </div>
                <Button onClick={handleAddTask} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  添加任务
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 任务列表 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>任务列表</CardTitle>
              <CardDescription>
                按序号排列，序号越小越靠前。任务会根据依赖关系自动计算开始和结束日期。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {formData.tasks && formData.tasks.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] min-w-[60px]">序号</TableHead>
                        <TableHead className="w-[280px] min-w-[280px]">任务信息</TableHead>
                        <TableHead className="w-[80px] min-w-[80px]">工时</TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">类型</TableHead>
                        <TableHead className="w-[100px] min-w-[100px]">优先级</TableHead>
                        <TableHead className="min-w-[200px]">依赖</TableHead>
                        <TableHead className="w-[70px] min-w-[70px]">并行</TableHead>
                        <TableHead className="w-[150px] min-w-[150px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.tasks.map((task, index) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium text-center align-middle py-4">{task.sequence}</TableCell>
                          <TableCell className="align-middle py-4">
                            <div className="space-y-3">
                              <Input
                                value={task.name}
                                onChange={(e) => handleUpdateTaskField(task.id, 'name', e.target.value)}
                                className="h-10 text-sm font-medium"
                                placeholder="任务名称"
                              />
                              <Input
                                value={task.description || ''}
                                onChange={(e) => handleUpdateTaskField(task.id, 'description', e.target.value)}
                                className="h-9 text-xs"
                                placeholder="任务描述（可选）"
                              />
                              {task.notes && (
                                <div className="text-xs text-blue-600 truncate">💡 {task.notes}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <Input
                              type="number"
                              min="1"
                              value={task.estimatedHours}
                              onChange={(e) => handleUpdateTaskField(task.id, 'estimatedHours', parseFloat(e.target.value) || 1)}
                              className="h-10 w-24"
                            />
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <Select 
                              value={task.taskType} 
                              onValueChange={(value: ResourceWorkType) => handleUpdateTaskField(task.id, 'taskType', value)}
                            >
                              <SelectTrigger className="h-10 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="平面">平面</SelectItem>
                                <SelectItem value="后期">后期</SelectItem>
                                <SelectItem value="物料">物料</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <Select 
                              value={task.priority} 
                              onValueChange={(value: any) => handleUpdateTaskField(task.id, 'priority', value)}
                            >
                              <SelectTrigger className="h-10 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="urgent">紧急</SelectItem>
                                <SelectItem value="high">高</SelectItem>
                                <SelectItem value="normal">普通</SelectItem>
                                <SelectItem value="low">低</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <div className="flex flex-wrap gap-2">
                              {availableSequences.filter(seq => seq !== task.sequence).map(seq => {
                                const depTask = getTaskBySequence(seq);
                                const depTaskName = depTask?.name || `任务${seq}`;
                                return (
                                  <label key={seq} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={task.dependencies?.includes(seq)}
                                      onChange={(e) => {
                                        const deps = task.dependencies || [];
                                        if (e.target.checked) {
                                          handleUpdateTaskField(task.id, 'dependencies', [...deps, seq]);
                                        } else {
                                          handleUpdateTaskField(task.id, 'dependencies', deps.filter(d => d !== seq));
                                        }
                                      }}
                                      className="h-4 w-4"
                                    />
                                    <span className="text-xs whitespace-nowrap">{depTaskName}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={task.allowParallel}
                                onChange={(e) => handleUpdateTaskField(task.id, 'allowParallel', e.target.checked)}
                                className="h-4 w-4"
                              />
                              <span className="text-xs whitespace-nowrap">{task.allowParallel ? '可并行' : '串行'}</span>
                            </label>
                          </TableCell>
                          <TableCell className="align-middle py-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveTask(index, 'up')}
                                disabled={index === 0}
                                className="h-10 w-10 p-0"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveTask(index, 'down')}
                                disabled={index === formData.tasks!.length - 1}
                                className="h-10 w-10 p-0"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                                className="h-10 w-10 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  还没有任务，请在上方添加任务
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存模板
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
