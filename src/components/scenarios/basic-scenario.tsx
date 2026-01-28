'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Plus, Trash2, CheckCircle, TrendingUp, Settings, Calendar, Download, Sparkles, Loader2 } from 'lucide-react';
import { generateSchedule } from '@/lib/schedule-algorithms';
import * as XLSX from 'xlsx';
import { defaultWorkingHours } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult, ResourceLevel } from '@/types/schedule';
import GanttChart from '@/components/gantt-chart';

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DD 格式
const formatDateToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

// 辅助函数：将 Date 或字符串转换为 YYYY-MM-DDTHH:mm 格式（用于datetime-local）
const formatDateTimeToInputValue = (date: Date | string | undefined): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const defaultResources: Resource[] = [
  {
    id: 'res-1',
    name: '张设计师',
    type: 'human',
    workType: '平面',
    level: 'senior',
    efficiency: 1.5,
    skills: ['平面设计', '品牌VI', 'UI设计'],
    availability: 0.9,
    color: '#3b82f6'
  },
  {
    id: 'res-2',
    name: '李后期',
    type: 'human',
    workType: '后期',
    level: 'senior',
    efficiency: 1.5,
    skills: ['视频剪辑', '特效制作', '调色'],
    availability: 1.0,
    color: '#10b981'
  },
  {
    id: 'res-3',
    name: '王平面',
    type: 'human',
    workType: '平面',
    level: 'junior',
    efficiency: 1.0,
    skills: ['插画设计', '分镜设计', '排版'],
    availability: 0.8,
    color: '#f59e0b'
  },
  {
    id: 'res-4',
    name: '赵后期',
    type: 'human',
    workType: '后期',
    level: 'junior',
    efficiency: 1.0,
    skills: ['字幕制作', '音频处理', '剪辑'],
    availability: 0.85,
    color: '#8b5cf6'
  },
  {
    id: 'res-5',
    name: '小助理',
    type: 'human',
    workType: '后期',
    level: 'assistant',
    efficiency: 0.7,
    skills: ['基础剪辑', '素材整理', '字幕制作'],
    availability: 0.9,
    color: '#ec4899'
  }
];

export default function BasicScenario() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [activeView, setActiveView] = useState<'gantt' | 'table'>('gantt');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);

  useEffect(() => {
    const savedTasks = localStorage.getItem('basic-scenario-tasks');
    const savedResources = localStorage.getItem('basic-scenario-resources');
    const savedScheduleResult = localStorage.getItem('basic-scenario-schedule-result');
    const savedStartDate = localStorage.getItem('basic-scenario-start-date');

    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      // 将日期字符串转换回 Date 对象
      const tasksWithDates = parsed.map((t: Task) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined
      }));
      setTasks(tasksWithDates);
    }
    if (savedResources) {
      setResources(JSON.parse(savedResources));
    } else {
      setResources(defaultResources);
    }
    if (savedScheduleResult) {
      const parsed = JSON.parse(savedScheduleResult);
      // 将日期字符串转换回 Date 对象
      const tasksWithDates = parsed.tasks.map((t: Task) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
        startDate: t.startDate ? new Date(t.startDate) : undefined,
        endDate: t.endDate ? new Date(t.endDate) : undefined
      }));
      setScheduleResult({ ...parsed, tasks: tasksWithDates });
    }
    if (savedStartDate) {
      setStartDate(new Date(savedStartDate));
    }
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('basic-scenario-tasks', JSON.stringify(tasks));
    }
    if (resources.length > 0) {
      localStorage.setItem('basic-scenario-resources', JSON.stringify(resources));
    }
    if (scheduleResult) {
      localStorage.setItem('basic-scenario-schedule-result', JSON.stringify(scheduleResult));
    }
    localStorage.setItem('basic-scenario-start-date', startDate.toISOString());
  }, [tasks, resources, scheduleResult, startDate]);

  const handleGenerateSchedule = () => {
    setIsComputing(true);
    setTimeout(() => {
      const result = generateSchedule(tasks, resources, startDate, defaultWorkingHours);
      setScheduleResult(result);
      setIsComputing(false);
    }, 500);
  };

  const handleAddTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      name: `新任务 ${tasks.length + 1}`,
      description: '',
      estimatedHours: 8,
      assignedResources: [],
      priority: 'normal',
      status: 'pending',
      taskType: '平面' // 默认为平面
    };
    setTasks([...tasks, newTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleTaskChange = (taskId: string, field: keyof Task, value: any) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t));
  };

  const handleAddResource = () => {
    const newResource: Resource = {
      id: `res-${Date.now()}`,
      name: '新成员',
      type: 'human',
      workType: '平面', // 默认为平面
      level: 'junior',
      efficiency: 1.0,
      availability: 1.0,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    setResources([...resources, newResource]);
  };

  const handleDeleteResource = (resourceId: string) => {
    setResources(resources.filter(r => r.id !== resourceId));
  };

  const handleResourceChange = (resourceId: string, field: keyof Resource, value: any) => {
    setResources(resources.map(r => r.id === resourceId ? { ...r, [field]: value } : r));
  };

  // 手动调整任务负责人
  const handleUpdateTaskResource = (taskId: string, newResourceId: string) => {
    if (!scheduleResult) return;

    const updatedTasks = scheduleResult.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          assignedResources: newResourceId ? [newResourceId] : []
        };
      }
      return task;
    });

    setScheduleResult({
      ...scheduleResult,
      tasks: updatedTasks
    });

    // 同步更新原始任务列表
    setTasks(tasks.map(t => t.id === taskId ? { ...t, assignedResources: newResourceId ? [newResourceId] : [] } : t));
  };

  // 导出Excel
  const handleExportToExcel = () => {
    if (!scheduleResult) return;

    // 准备导出数据
    const exportData = scheduleResult.tasks.map(task => {
      const resource = resources.find(r => r.id === task.assignedResources[0]);
      return {
        '任务名称': task.name,
        '任务类型': task.taskType || '未指定',
        '负责人': resource ? resource.name : '未分配',
        '负责人等级': resource ? (resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理') : '-',
        '负责人类型': resource ? resource.workType || '-' : '-',
        '预估工时(小时)': task.estimatedHours,
        '优先级': task.priority,
        '开始时间': task.startDate ? formatDateTime(task.startDate) : '-',
        '结束时间': task.endDate ? formatDateTime(task.endDate) : '-',
        '状态': task.isCritical ? '关键路径' : '普通',
        '截止日期': task.deadline ? formatDateToInputValue(task.deadline) : '-'
      };
    });

    // 创建工作簿
    const ws = XLSX.utils.json_to_sheet(exportData);

    // 设置列宽
    const colWidths = [
      { wch: 20 }, // 任务名称
      { wch: 10 }, // 任务类型
      { wch: 12 }, // 负责人
      { wch: 10 }, // 负责人等级
      { wch: 10 }, // 负责人类型
      { wch: 12 }, // 预估工时
      { wch: 8 },  // 优先级
      { wch: 18 }, // 开始时间
      { wch: 18 }, // 结束时间
      { wch: 10 }, // 状态
      { wch: 12 }  // 截止日期
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '排期表');

    // 下载文件
    const fileName = `项目排期_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'senior': return 'bg-purple-500 text-white';
      case 'junior': return 'bg-blue-500 text-white';
      case 'assistant': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const formatDateTime = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '无效日期';
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${timeStr}`;
  };

  // AI优化排期
  const handleAiOptimize = async () => {
    if (!scheduleResult || tasks.length === 0) {
      alert('请先生成排期结果');
      return;
    }

    setIsAiOptimizing(true);
    setAiSuggestion('');

    try {
      const response = await fetch('/api/ai-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks,
          resources,
          currentResult: scheduleResult,
        }),
      });

      if (!response.ok) {
        throw new Error('AI优化请求失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedText += parsed.content;
                setAiSuggestion(accumulatedText);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('AI优化错误:', error);
      alert('AI优化失败，请稍后重试');
    } finally {
      setIsAiOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" />
                可用资源池
              </CardTitle>
              <CardDescription>
                管理团队成员，设置等级和效率，系统会自动分配任务
              </CardDescription>
            </div>
            <Button onClick={handleAddResource} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              添加成员
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {resources.filter(r => r.type === 'human').map(resource => {
              const efficiency = resource.efficiency || 1.0;
              return (
                <div key={resource.id} className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: resource.color }}
                      />
                      <Input
                        value={resource.name}
                        onChange={(e) => handleResourceChange(resource.id, 'name', e.target.value)}
                        className="h-6 w-20 text-sm border-0 bg-transparent px-0 focus:ring-0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteResource(resource.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                  <div className="mb-3">
                    <Select
                      value={resource.workType || 'none'}
                      onValueChange={(value) => handleResourceChange(resource.id, 'workType', value !== 'none' ? value : '')}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未指定</SelectItem>
                        <SelectItem value="平面">平面</SelectItem>
                        <SelectItem value="后期">后期</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mb-3">
                    <Select
                      value={resource.level || 'junior'}
                      onValueChange={(value: ResourceLevel) => handleResourceChange(resource.id, 'level', value)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assistant">助理</SelectItem>
                        <SelectItem value="junior">初级</SelectItem>
                        <SelectItem value="senior">高级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>效率:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={efficiency}
                          onChange={(e) => handleResourceChange(resource.id, 'efficiency', parseFloat(e.target.value))}
                          className="h-6 w-14 text-right text-xs"
                        />
                        <span>x</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>可用性:</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1.0"
                          value={resource.availability}
                          onChange={(e) => handleResourceChange(resource.id, 'availability', parseFloat(e.target.value))}
                          className="h-6 w-14 text-right text-xs"
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 资源属性说明 */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">📖 资源属性说明</h4>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">效率系数</div>
              <div className="text-blue-700 dark:text-blue-300">
                表示员工的工作效率，用于资源分配评分。例如：效率1.5的员工完成任务速度是效率1.0员工的1.5倍。数值越高，效率越高。
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">可用性</div>
              <div className="text-blue-700 dark:text-blue-300">
                表示员工的工作时间占比。例如：可用性0.9表示员工每天有90%的时间可用于项目任务，其余10%可能用于其他事务。数值范围为0.1-1.0。
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">等级</div>
              <div className="text-blue-700 dark:text-blue-300">
                表示员工的专业水平和经验。分为：
                <br />• <span className="text-purple-600 font-medium">高级</span>：经验丰富，效率1.5倍
                <br />• <span className="text-blue-600 font-medium">初级</span>：基础水平，效率1.0倍
                <br />• <span className="text-slate-600 font-medium">助理</span>：协助角色，效率0.7倍
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>任务管理</CardTitle>
          <CardDescription>
            定义项目任务、预估工时、设置优先级和依赖关系
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button onClick={handleAddTask} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              添加任务
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium">开始时间:</label>
              <Input
                type="datetime-local"
                value={formatDateTimeToInputValue(startDate)}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-48 h-9"
              />
            </div>
            <Button
              onClick={handleGenerateSchedule}
              disabled={isComputing || tasks.length === 0}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isComputing ? '计算中...' : '生成排期'}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">任务名称</TableHead>
                  <TableHead>任务类型</TableHead>
                  {!tasks.some(t => t.taskType === '物料') && (
                    <>
                      <TableHead>预估工时</TableHead>
                      <TableHead>优先级</TableHead>
                      <TableHead>截止日期</TableHead>
                      <TableHead className="w-[180px]">依赖任务</TableHead>
                    </>
                  )}
                  {tasks.some(t => t.taskType === '物料') && (
                    <TableHead>物料提供时间</TableHead>
                  )}
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Input
                        value={task.name}
                        onChange={(e) => handleTaskChange(task.id, 'name', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={task.taskType || 'none'}
                        onValueChange={(value) => handleTaskChange(task.id, 'taskType', value !== 'none' ? value : '')}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="未指定" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">未指定</SelectItem>
                          <SelectItem value="平面">平面</SelectItem>
                          <SelectItem value="后期">后期</SelectItem>
                          <SelectItem value="物料">物料</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {task.taskType === '物料' ? (
                      <TableCell>
                        <Input
                          type="datetime-local"
                          value={formatDateTimeToInputValue(task.estimatedMaterialDate)}
                          onChange={(e) => handleTaskChange(task.id, 'estimatedMaterialDate', new Date(e.target.value))}
                          className="w-48 h-8"
                          placeholder="选择提供时间"
                        />
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <Input
                            type="number"
                            value={task.estimatedHours}
                            onChange={(e) => handleTaskChange(task.id, 'estimatedHours', parseInt(e.target.value))}
                            className="w-24 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.priority}
                            onValueChange={(value) => handleTaskChange(task.id, 'priority', value)}
                          >
                            <SelectTrigger className="h-8">
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
                        <TableCell>
                          <Input
                            type="date"
                            value={formatDateToInputValue(task.deadline)}
                            onChange={(e) => handleTaskChange(task.id, 'deadline', new Date(e.target.value))}
                            className="w-36 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.dependencies && task.dependencies.length > 0 ? task.dependencies[0] : 'none'}
                            onValueChange={(value) => handleTaskChange(task.id, 'dependencies', value !== 'none' ? [value] : [])}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="无依赖" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">无依赖</SelectItem>
                              {tasks.filter(t => t.id !== task.id).map(dependencyTask => (
                                <SelectItem key={dependencyTask.id} value={dependencyTask.id}>
                                  {dependencyTask.name} {dependencyTask.taskType === '物料' && '(物料)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 任务优先级说明 */}
      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 text-green-900 dark:text-green-100">📖 任务优先级说明</h4>
          <div className="text-sm text-green-700 dark:text-green-300">
            <div className="font-medium mb-2">优先级用于资源分配时的任务排序和权重计算：</div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <span className="text-red-500 font-bold min-w-[60px]">紧急</span>
                <span>权重3，最高优先级，优先分配资源，适用于关键路径上的任务</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 font-bold min-w-[60px]">高</span>
                <span>权重2，高优先级，适用于重要任务</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold min-w-[60px]">普通</span>
                <span>权重1，标准优先级，适用于常规任务</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 font-bold min-w-[60px]">低</span>
                <span>权重0.5，最低优先级，适用于次要任务</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
              <strong>分配策略：</strong>系统会综合计算每个任务的"优先级权重 × 预估工时"，按得分高低自动分配资源。
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资源效率说明 */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">⚡ 资源效率说明</h4>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <div className="font-medium mb-2">效率系数影响任务实际完成时间：</div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="flex items-start gap-2">
                <span className="text-purple-500 font-bold min-w-[60px]">高级</span>
                <span>效率1.5倍，8小时任务实际只需5.3小时完成</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500 font-bold min-w-[60px]">初级</span>
                <span>效率1.0倍，8小时任务实际用时8小时</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-500 font-bold min-w-[60px]">助理</span>
                <span>效率0.7倍，8小时任务实际需要11.4小时</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <strong>影响体现：</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>甘特图任务条长度反映实际完成时间</li>
                <li>高效率人员的任务条更短</li>
                <li>资源利用率计算考虑效率加成</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {scheduleResult && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>总工期</CardDescription>
                <CardTitle className="text-2xl">{scheduleResult.totalDuration} 天</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>总工时</CardDescription>
                <CardTitle className="text-2xl">{scheduleResult.totalHours} 小时</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>关键路径</CardDescription>
                <CardTitle className="text-2xl">{scheduleResult.criticalPath.length} 个任务</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>资源冲突</CardDescription>
                <CardTitle className={`text-2xl ${scheduleResult.resourceConflicts.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {scheduleResult.resourceConflicts.length} 个
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>排期结果</CardTitle>
                <div className="flex items-center gap-3">
                  <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
                    <TabsList>
                      <TabsTrigger value="gantt">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        甘特图
                      </TabsTrigger>
                      <TabsTrigger value="table">
                        <Calendar className="h-4 w-4 mr-2" />
                        列表视图
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleAiOptimize}
                      disabled={isAiOptimizing}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      {isAiOptimizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isAiOptimizing ? 'AI分析中...' : 'AI优化排期'}
                    </Button>
                    <Button onClick={handleExportToExcel} size="sm" variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      导出Excel
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeView === 'gantt' && (
                <GanttChart
                  scheduleResult={scheduleResult}
                  resources={resources}
                />
              )}

              {activeView === 'table' && (
                <div className="rounded-md border">
                  <div className="overflow-x-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">任务名称</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">负责人</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">开始时间</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">结束时间</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">工时</th>
                          <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap">状态</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {scheduleResult.tasks.map(task => {
                          const resource = resources.find(r => r.id === task.assignedResources[0]);
                          return (
                            <tr key={task.id} className="hover:bg-muted/50 border-b transition-colors">
                              <td className="p-2 align-middle whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {task.isCritical && (
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                  )}
                                  <span className="font-medium">{task.name}</span>
                                  {task.taskType === '物料' && (
                                    <Badge variant="outline" className="text-xs">物料</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap min-w-[250px]">
                                {task.taskType === '物料' ? (
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <span>甲方提供</span>
                                    {task.estimatedMaterialDate && (
                                      <span className="text-xs">
                                        （{formatDateTime(task.estimatedMaterialDate)}）
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={task.assignedResources[0] || 'none'}
                                      onValueChange={(value) => handleUpdateTaskResource(task.id, value !== 'none' ? value : '')}
                                    >
                                      <SelectTrigger className="h-8 min-w-[160px]">
                                        <SelectValue>
                                          {resource ? (
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: resource.color }}
                                              />
                                              <span className="text-sm">{resource.name}</span>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 text-sm">未分配</span>
                                          )}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">未分配</SelectItem>
                                        {resources
                                          .filter(r => r.type === 'human' && (!task.taskType || r.workType === task.taskType))
                                          .map(r => (
                                          <SelectItem key={r.id} value={r.id}>
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: r.color }}
                                              />
                                              <span>{r.name}</span>
                                              <span className="text-xs text-slate-500">
                                                ({r.level === 'senior' ? '高级' : r.level === 'junior' ? '初级' : '助理'})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {resource && (
                                      <Badge className={getLevelBadgeColor(resource.level || 'junior')} variant="secondary" style={{ fontSize: '10px', padding: '2px 6px' }} title={resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理'}>
                                        {resource.level === 'senior' ? '高级' : resource.level === 'junior' ? '初级' : '助理'}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap text-sm">
                                {task.startDate && formatDateTime(task.startDate)}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap text-sm">
                                {task.endDate && formatDateTime(task.endDate)}
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                <span className="text-sm font-medium">{task.estimatedHours}h</span>
                              </td>
                              <td className="p-2 align-middle whitespace-nowrap">
                                {task.isCritical ? (
                                  <Badge variant="destructive">关键路径</Badge>
                                ) : (
                                  <Badge variant="outline">普通</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {scheduleResult.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  优化建议
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scheduleResult.recommendations.map((rec, index) => (
                    <div key={index} className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {aiSuggestion && (
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI智能优化建议
                </CardTitle>
                <CardDescription className="text-purple-700 dark:text-purple-300">
                  基于大语言模型分析，为您提供最高效率的排期优化方案
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap">{aiSuggestion}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
