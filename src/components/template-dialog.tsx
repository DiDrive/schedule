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
import { Calendar, CheckCircle2, Clock, FileText, Sparkles, TrendingUp } from 'lucide-react';
import { ProjectTemplate, Project, Task } from '@/types/schedule';
import { defaultProjectTemplates } from '@/lib/project-templates';
import { createProjectFromTemplate, calculateProjectDuration, calculateTotalHours, getTaskTypeStats } from '@/lib/template-generator';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (project: Project) => void;
  existingTemplates?: ProjectTemplate[];
}

export default function TemplateDialog({ open, onOpenChange, onProjectCreated, existingTemplates }: TemplateDialogProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(defaultProjectTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState(5);
  const [previewTasks, setPreviewTasks] = useState<Task[]>([]);

  // 从 localStorage 加载自定义模板
  useEffect(() => {
    const customTemplatesStr = localStorage.getItem('project-templates');
    if (customTemplatesStr) {
      try {
        const customTemplates = JSON.parse(customTemplatesStr);
        setTemplates([...defaultProjectTemplates, ...customTemplates]);
      } catch (error) {
        console.error('Failed to load custom templates:', error);
      }
    }
  }, [existingTemplates]);

  // 当选择的模板或开始日期改变时，更新预览
  useEffect(() => {
    if (selectedTemplate && startDate) {
      const tasks = createProjectFromTemplate(
        selectedTemplate,
        '预览项目',
        new Date(startDate),
        priority,
        [],
        selectedTemplate.description
      ).tasks;
      setPreviewTasks(tasks);
    } else {
      setPreviewTasks([]);
    }
  }, [selectedTemplate, startDate, priority]);

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    if (!projectName) {
      setProjectName(`${template.name} - ${new Date().toLocaleDateString('zh-CN')}`);
    }
  };

  const handleCreateProject = () => {
    if (!selectedTemplate) {
      alert('请选择一个模板');
      return;
    }

    if (!projectName) {
      alert('请输入项目名称');
      return;
    }

    if (!startDate) {
      alert('请选择项目开始日期');
      return;
    }

    try {
      const project = createProjectFromTemplate(
        selectedTemplate,
        projectName,
        new Date(startDate),
        priority,
        [],
        projectDescription
      );

      onProjectCreated(project);
      onOpenChange(false);
      
      // 重置表单
      setSelectedTemplate(null);
      setProjectName('');
      setProjectDescription('');
      setStartDate('');
      setPriority(5);
      setPreviewTasks([]);
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建项目失败，请检查输入');
    }
  };

  const totalHours = calculateTotalHours(previewTasks);
  const duration = calculateProjectDuration(previewTasks);
  const typeStats = getTaskTypeStats(previewTasks);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <FileText className="h-6 w-6" />
            </div>
            使用模板创建项目
          </DialogTitle>
          <DialogDescription>
            选择项目模板，快速生成标准化的任务列表
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="select" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select">选择模板</TabsTrigger>
              <TabsTrigger value="preview" disabled={!selectedTemplate}>
                预览任务
              </TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedTemplate?.id === template.id
                        ? 'ring-2 ring-purple-500 shadow-lg'
                        : ''
                    }`}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {template.description}
                          </CardDescription>
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <CheckCircle2 className="h-6 w-6 text-purple-500 flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{template.category}</Badge>
                          {template.isDefault && (
                            <Badge variant="outline" className="text-purple-600 border-purple-600">
                              默认模板
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{template.tasks.length} 个任务</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            <span>{template.tasks.reduce((sum, t) => sum + t.estimatedHours, 0)} 小时</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedTemplate && (
                <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      项目配置
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="projectName">项目名称</Label>
                        <Input
                          id="projectName"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="输入项目名称"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="startDate">开始日期</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="projectDescription">项目描述（可选）</Label>
                        <Input
                          id="projectDescription"
                          value={projectDescription}
                          onChange={(e) => setProjectDescription(e.target.value)}
                          placeholder="输入项目描述"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button onClick={() => {
                        const previewTab = document.querySelector('[value="preview"]') as HTMLElement;
                        previewTab?.click();
                      }}>
                        查看预览
                      </Button>
                      <Button onClick={handleCreateProject} className="bg-gradient-to-r from-purple-500 to-pink-500">
                        创建项目
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>项目概览</CardTitle>
                  <CardDescription>
                    {selectedTemplate?.name} - {projectName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {previewTasks.length}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">任务总数</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <Clock className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {totalHours}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">总工时</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                          {duration}
                        </div>
                        <div className="text-sm text-purple-700 dark:text-purple-300">预计工期（天）</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="font-semibold mb-2">任务类型分布</h5>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(typeStats).map(([type, stats]) => (
                        <Badge key={type} variant="secondary">
                          {type}: {stats.count} 个任务 ({stats.hours}h)
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>任务列表</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">序号</TableHead>
                          <TableHead>任务名称</TableHead>
                          <TableHead>工时</TableHead>
                          <TableHead>优先级</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>依赖</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewTasks.map((task, index) => {
                          const templateTask = selectedTemplate?.tasks[index];
                          return (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">
                                {templateTask?.sequence}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{task.name}</div>
                                  {task.description && (
                                    <div className="text-xs text-slate-500 mt-1">
                                      {task.description}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{task.estimatedHours}h</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    task.priority === 'urgent'
                                      ? 'destructive'
                                      : task.priority === 'high'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'normal' ? '普通' : '低'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{task.taskType}</Badge>
                              </TableCell>
                              <TableCell>
                                {task.dependencies && task.dependencies.length > 0 ? (
                                  <Badge variant="secondary">
                                    {task.dependencies.length} 个
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400">无</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
