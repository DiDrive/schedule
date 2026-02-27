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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, CheckCircle2, Clock, FileText, Sparkles, TrendingUp, Plus, Trash2, Edit2 } from 'lucide-react';
import { ProjectTemplate, Project } from '@/types/schedule';
import { defaultProjectTemplates } from '@/lib/project-templates';
import { createProjectFromTemplate } from '@/lib/template-generator';
import TemplateEditor from '@/components/template-editor';

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (project: Project) => void;
  existingTemplates?: ProjectTemplate[];
}

export default function TemplateDialog({ open, onOpenChange, onProjectCreated, existingTemplates }: TemplateDialogProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>(defaultProjectTemplates);
  const [customTemplates, setCustomTemplates] = useState<ProjectTemplate[]>([]);
  const [hiddenTemplates, setHiddenTemplates] = useState<string[]>([]); // 隐藏的默认模板 ID 列表
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState(5);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | undefined>(undefined);

  // 从 localStorage 加载自定义模板和隐藏的默认模板
  useEffect(() => {
    loadCustomTemplates();
    loadHiddenTemplates();
  }, []);

  // 当对话框打开时，重置状态
  useEffect(() => {
    if (open) {
      setSelectedTemplate(null);
      setProjectName('');
      setProjectDescription('');
      setStartDate('');
      setPriority(5);
    }
  }, [open]);

  const loadCustomTemplates = () => {
    const customTemplatesStr = localStorage.getItem('project-templates');
    if (customTemplatesStr) {
      try {
        const templates = JSON.parse(customTemplatesStr);
        setCustomTemplates(templates);
        // 过滤掉隐藏的模板
        const visibleDefaultTemplates = defaultProjectTemplates.filter(t => !hiddenTemplates.includes(t.id));
        setTemplates([...visibleDefaultTemplates, ...templates]);
      } catch (error) {
        console.error('Failed to load custom templates:', error);
      }
    } else {
      // 过滤掉隐藏的模板
      const visibleDefaultTemplates = defaultProjectTemplates.filter(t => !hiddenTemplates.includes(t.id));
      setTemplates(visibleDefaultTemplates);
    }
  };

  const loadHiddenTemplates = () => {
    const hiddenTemplatesStr = localStorage.getItem('hidden-templates');
    if (hiddenTemplatesStr) {
      try {
        const templates = JSON.parse(hiddenTemplatesStr);
        setHiddenTemplates(templates);
      } catch (error) {
        console.error('Failed to load hidden templates:', error);
      }
    }
  };

  const saveHiddenTemplates = (templates: string[]) => {
    localStorage.setItem('hidden-templates', JSON.stringify(templates));
    setHiddenTemplates(templates);
  };

  const saveCustomTemplates = (templates: ProjectTemplate[]) => {
    localStorage.setItem('project-templates', JSON.stringify(templates));
    setCustomTemplates(templates);
    // 过滤掉隐藏的模板
    const visibleDefaultTemplates = defaultProjectTemplates.filter(t => !hiddenTemplates.includes(t.id));
    setTemplates([...visibleDefaultTemplates, ...templates]);
  };

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
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建项目失败，请检查输入');
    }
  };

  const handleEditTemplate = (template: ProjectTemplate) => {
    // 如果编辑的是默认模板，将其转换为自定义模板
    if (template.isDefault) {
      const customTemplate: ProjectTemplate = {
        ...template,
        id: `custom-${template.id}-${Date.now()}`,
        isDefault: false,
        name: `${template.name} (副本)`,
        description: `${template.description} (自定义版本)`
      };
      setEditingTemplate(customTemplate);
    } else {
      setEditingTemplate(template);
    }
    setShowTemplateEditor(true);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('确定要删除这个模板吗？')) return;

    // 检查是否是默认模板
    const isDefaultTemplate = defaultProjectTemplates.some(t => t.id === templateId);

    if (isDefaultTemplate) {
      // 默认模板：添加到隐藏列表
      const newHiddenTemplates = [...hiddenTemplates, templateId];
      saveHiddenTemplates(newHiddenTemplates);
    } else {
      // 自定义模板：从列表中移除
      const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
      saveCustomTemplates(updatedTemplates);
    }
    
    // 如果删除的是当前选中的模板，取消选择
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null);
    }
  };

  const handleSaveTemplate = (template: ProjectTemplate) => {
    // 检查是新增还是编辑
    const existingIndex = customTemplates.findIndex(t => t.id === template.id);
    
    if (existingIndex >= 0) {
      // 编辑现有模板
      const updatedTemplates = [...customTemplates];
      updatedTemplates[existingIndex] = template;
      saveCustomTemplates(updatedTemplates);
    } else {
      // 新增模板
      saveCustomTemplates([...customTemplates, template]);
    }

    setShowTemplateEditor(false);
    setEditingTemplate(undefined);
  };

  const allTemplates = [...defaultProjectTemplates, ...customTemplates].filter(t => !hiddenTemplates.includes(t.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                <FileText className="h-6 w-6" />
              </div>
              使用模板创建项目
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTemplate(undefined);
                setShowTemplateEditor(true);
              }}
              className="gap-2 mr-2"
            >
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          </DialogTitle>
          <DialogDescription className="mt-2">
            选择项目模板，快速生成标准化的任务列表
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedTemplate?.id === template.id
                        ? 'ring-2 ring-purple-500 shadow-lg'
                        : ''
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                          <CardDescription className="mt-1 line-clamp-2">
                            {template.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTemplate(template);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                            className="h-8 w-8 p-0 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {selectedTemplate?.id === template.id && (
                            <CheckCircle2 className="h-6 w-6 text-purple-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{template.category}</Badge>
                          {template.isDefault && (
                            <Badge variant="outline" className="text-purple-600 border-purple-600">
                              默认模板
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">{template.tasks.length} 个任务</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">{template.tasks.reduce((sum, t) => sum + t.estimatedHours, 0)} 小时</span>
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
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleCreateProject} className="bg-gradient-to-r from-purple-500 to-pink-500">
                        创建项目
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </DialogContent>

      {/* 模板编辑器 */}
      <TemplateEditor
        open={showTemplateEditor}
        onOpenChange={setShowTemplateEditor}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </Dialog>
  );
}
