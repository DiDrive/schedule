'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';

export default function ExcelTemplateGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [isExportingSystemData, setIsExportingSystemData] = useState(false);

  // 生成字段配置说明文档
  const generateExcelTemplate = () => {
    setIsGenerating(true);

    try {
      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表
      const resourcesSheet = XLSX.utils.json_to_sheet([
        {
          '字段ID': 'id',
          '字段名称': '人员ID',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '系统自动生成的唯一标识',
          '示例值': 'res-001'
        },
        {
          '字段ID': 'name',
          '字段名称': '姓名',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '人员姓名',
          '示例值': '张三'
        },
        {
          '字段ID': 'type',
          '字段名称': '类型',
          '字段类型': '单选',
          '必填': '是',
          '说明': '人员类型（选项：平面设计、后期制作、物料）',
          '示例值': '平面设计'
        },
        {
          '字段ID': 'efficiency',
          '字段名称': '效率系数',
          '字段类型': '数字',
          '必填': '是',
          '说明': '效率系数（0.5-2.0）',
          '示例值': '1.0'
        },
        {
          '字段ID': 'feishu_user',
          '字段名称': '飞书用户ID',
          '字段类型': '人员',
          '必填': '否',
          '说明': '对应的飞书用户',
          '示例值': ''
        },
        {
          '字段ID': 'total_hours',
          '字段名称': '累计工时',
          '字段类型': '数字',
          '必填': '否',
          '说明': '累计工作小时数',
          '示例值': '0'
        },
        {
          '字段ID': 'created_at',
          '字段名称': '创建时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录创建时间（包含时间）',
          '示例值': ''
        },
        {
          '字段ID': 'updated_at',
          '字段名称': '更新时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录更新时间（包含时间）',
          '示例值': ''
        }
      ]);
      XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表');

      // 2. 项目表
      const projectsSheet = XLSX.utils.json_to_sheet([
        {
          '字段ID': 'id',
          '字段名称': '项目ID',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '项目唯一标识',
          '示例值': 'proj-001'
        },
        {
          '字段ID': 'name',
          '字段名称': '项目名称',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '项目名称',
          '示例值': 'XX品牌VI设计'
        },
        {
          '字段ID': 'description',
          '字段名称': '描述',
          '字段类型': '多行文本',
          '必填': '否',
          '说明': '项目描述',
          '示例值': 'XX品牌VI设计项目'
        },
        {
          '字段ID': 'start_date',
          '字段名称': '开始日期',
          '字段类型': '日期',
          '必填': '否',
          '说明': '项目开始日期',
          '示例值': '2024-01-01'
        },
        {
          '字段ID': 'end_date',
          '字段名称': '结束日期',
          '字段类型': '日期',
          '必填': '否',
          '说明': '项目结束日期',
          '示例值': '2024-01-31'
        },
        {
          '字段ID': 'status',
          '字段名称': '状态',
          '字段类型': '单选',
          '必填': '否',
          '说明': '项目状态（选项：未开始、进行中、已完成、已暂停）',
          '示例值': '进行中'
        },
        {
          '字段ID': 'created_at',
          '字段名称': '创建时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录创建时间',
          '示例值': ''
        },
        {
          '字段ID': 'updated_at',
          '字段名称': '更新时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录更新时间',
          '示例值': ''
        }
      ]);
      XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表');

      // 3. 任务表
      const tasksSheet = XLSX.utils.json_to_sheet([
        {
          '字段ID': 'id',
          '字段名称': '任务ID',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '任务唯一标识',
          '示例值': 'task-001'
        },
        {
          '字段ID': 'name',
          '字段名称': '任务名称',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '任务名称',
          '示例值': 'Logo设计'
        },
        {
          '字段ID': 'project_id',
          '字段名称': '项目',
          '字段类型': '关联记录',
          '必填': '否',
          '说明': '关联项目表的记录',
          '示例值': 'proj-001'
        },
        {
          '字段ID': 'type',
          '字段名称': '类型',
          '字段类型': '单选',
          '必填': '是',
          '说明': '任务类型（选项：平面设计、后期制作、物料）',
          '示例值': '平面设计'
        },
        {
          '字段ID': 'estimated_hours',
          '字段名称': '预估工时',
          '字段类型': '数字',
          '必填': '是',
          '说明': '预估工作小时数',
          '示例值': '8'
        },
        {
          '字段ID': 'actual_hours',
          '字段名称': '实际工时',
          '字段类型': '数字',
          '必填': '否',
          '说明': '实际工作小时数',
          '示例值': '0'
        },
        {
          '字段ID': 'start_time',
          '字段名称': '开始时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '任务开始时间（包含时间）',
          '示例值': '2024-01-01 09:30'
        },
        {
          '字段ID': 'end_time',
          '字段名称': '结束时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '任务结束时间（包含时间）',
          '示例值': '2024-01-02 18:30'
        },
        {
          '字段ID': 'deadline',
          '字段名称': '截止日期',
          '字段类型': '日期',
          '必填': '否',
          '说明': '任务截止日期（包含时间）',
          '示例值': '2024-01-05 18:30'
        },
        {
          '字段ID': 'priority',
          '字段名称': '优先级',
          '字段类型': '单选',
          '必填': '是',
          '说明': '任务优先级（选项：高、中、低）',
          '示例值': '高'
        },
        {
          '字段ID': 'assignee',
          '字段名称': '负责人',
          '字段类型': '人员',
          '必填': '否',
          '说明': '任务负责人',
          '示例值': 'res-001'
        },
        {
          '字段ID': 'dependencies',
          '字段名称': '依赖任务',
          '字段类型': '关联记录',
          '必填': '否',
          '说明': '依赖的其他任务（自关联）',
          '示例值': ''
        },
        {
          '字段ID': 'status',
          '字段名称': '状态',
          '字段类型': '单选',
          '必填': '是',
          '说明': '任务状态（选项：未开始、进行中、已完成、已暂停、已超期）',
          '示例值': '未开始'
        },
        {
          '字段ID': 'is_overdue',
          '字段名称': '是否超期',
          '字段类型': '复选框',
          '必填': '否',
          '说明': '是否超期',
          '示例值': 'false'
        },
        {
          '字段ID': 'feishu_version',
          '字段名称': '飞书记录版本',
          '字段类型': '数字',
          '必填': '否',
          '说明': '版本号（冲突检测用）',
          '示例值': '0'
        },
        {
          '字段ID': 'created_at',
          '字段名称': '创建时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录创建时间',
          '示例值': ''
        },
        {
          '字段ID': 'updated_at',
          '字段名称': '更新时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录更新时间',
          '示例值': ''
        }
      ]);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');

      // 4. 排期表
      const schedulesSheet = XLSX.utils.json_to_sheet([
        {
          '字段ID': 'id',
          '字段名称': '排期ID',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '排期唯一标识',
          '示例值': 'sch-001'
        },
        {
          '字段ID': 'task_id',
          '字段名称': '任务',
          '字段类型': '关联记录',
          '必填': '否',
          '说明': '关联任务表的记录',
          '示例值': 'task-001'
        },
        {
          '字段ID': 'person_id',
          '字段名称': '人员',
          '字段类型': '关联记录',
          '必填': '否',
          '说明': '关联人员表的记录',
          '示例值': 'res-001'
        },
        {
          '字段ID': 'start_time',
          '字段名称': '开始时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '排期开始时间',
          '示例值': '2024-01-01 09:30'
        },
        {
          '字段ID': 'end_time',
          '字段名称': '结束时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '排期结束时间',
          '示例值': '2024-01-10 18:30'
        },
        {
          '字段ID': 'created_at',
          '字段名称': '创建时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录创建时间',
          '示例值': ''
        },
        {
          '字段ID': 'updated_at',
          '字段名称': '更新时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '记录更新时间',
          '示例值': ''
        }
      ]);
      XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表');

      // 生成 Excel 文件
      XLSX.writeFile(workbook, '飞书多维表字段配置模板.xlsx');
    } catch (error) {
      console.error('生成 Excel 模板失败:', error);
      alert('生成 Excel 模板失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成包含示例数据的模板
  const generateDataTemplate = () => {
    setIsGeneratingData(true);

    try {
      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表 - 示例数据
      const resourcesData = [
        {
          'id': 'res-001',
          'name': '张三',
          'type': '平面设计',
          'efficiency': '1.0',
          'feishu_user': '',
          'total_hours': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'res-002',
          'name': '李四',
          'type': '平面设计',
          'efficiency': '1.2',
          'feishu_user': '',
          'total_hours': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'res-003',
          'name': '王五',
          'type': '后期制作',
          'efficiency': '0.9',
          'feishu_user': '',
          'total_hours': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'res-004',
          'name': '赵六',
          'type': '后期制作',
          'efficiency': '1.1',
          'feishu_user': '',
          'total_hours': '0',
          'created_at': '',
          'updated_at': ''
        }
      ];
      const resourcesSheet = XLSX.utils.json_to_sheet(resourcesData);
      XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表');

      // 2. 项目表 - 示例数据
      const projectsData = [
        {
          'id': 'proj-001',
          'name': 'XX品牌VI设计',
          'description': 'XX品牌VI设计项目',
          'start_date': '2024-01-01',
          'end_date': '2024-01-31',
          'status': '进行中',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'proj-002',
          'name': 'YY品牌视频制作',
          'description': 'YY品牌视频制作项目',
          'start_date': '2024-02-01',
          'end_date': '2024-02-28',
          'status': '未开始',
          'created_at': '',
          'updated_at': ''
        }
      ];
      const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
      XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表');

      // 3. 任务表 - 示例数据
      const tasksData = [
        {
          'id': 'task-001',
          'name': 'Logo设计',
          'project_id': 'proj-001',
          'type': '平面设计',
          'estimated_hours': '8',
          'actual_hours': '0',
          'start_time': '',
          'end_time': '',
          'deadline': '2024-01-10 18:30',
          'priority': '高',
          'assignee': 'res-001',
          'dependencies': '',
          'status': '未开始',
          'is_overdue': 'false',
          'feishu_version': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'task-002',
          'name': 'VI手册设计',
          'project_id': 'proj-001',
          'type': '平面设计',
          'estimated_hours': '16',
          'actual_hours': '0',
          'start_time': '',
          'end_time': '',
          'deadline': '2024-01-15 18:30',
          'priority': '中',
          'assignee': 'res-002',
          'dependencies': 'task-001',
          'status': '未开始',
          'is_overdue': 'false',
          'feishu_version': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'task-003',
          'name': '宣传片剪辑',
          'project_id': 'proj-002',
          'type': '后期制作',
          'estimated_hours': '12',
          'actual_hours': '0',
          'start_time': '',
          'end_time': '',
          'deadline': '2024-02-20 18:30',
          'priority': '高',
          'assignee': 'res-003',
          'dependencies': '',
          'status': '未开始',
          'is_overdue': 'false',
          'feishu_version': '0',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'task-004',
          'name': '视频调色',
          'project_id': 'proj-002',
          'type': '后期制作',
          'estimated_hours': '8',
          'actual_hours': '0',
          'start_time': '',
          'end_time': '',
          'deadline': '2024-02-25 18:30',
          'priority': '中',
          'assignee': 'res-004',
          'dependencies': 'task-003',
          'status': '未开始',
          'is_overdue': 'false',
          'feishu_version': '0',
          'created_at': '',
          'updated_at': ''
        }
      ];
      const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');

      // 4. 排期表 - 示例数据
      const schedulesData = [
        {
          'id': 'sch-001',
          'task_id': 'task-001',
          'person_id': 'res-001',
          'start_time': '',
          'end_time': '',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'sch-002',
          'task_id': 'task-002',
          'person_id': 'res-002',
          'start_time': '',
          'end_time': '',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'sch-003',
          'task_id': 'task-003',
          'person_id': 'res-003',
          'start_time': '',
          'end_time': '',
          'created_at': '',
          'updated_at': ''
        },
        {
          'id': 'sch-004',
          'task_id': 'task-004',
          'person_id': 'res-004',
          'start_time': '',
          'end_time': '',
          'created_at': '',
          'updated_at': ''
        }
      ];
      const schedulesSheet = XLSX.utils.json_to_sheet(schedulesData);
      XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表');

      // 生成 Excel 文件
      XLSX.writeFile(workbook, '飞书多维表示例数据模板.xlsx');
    } catch (error) {
      console.error('生成数据模板失败:', error);
      alert('生成数据模板失败，请重试');
    } finally {
      setIsGeneratingData(false);
    }
  };

  // 从当前系统数据导出到 Excel
  const exportSystemDataToExcel = () => {
    setIsExportingSystemData(true);

    try {
      // 从 localStorage 读取当前系统数据
      const basicResourcesStr = localStorage.getItem('basic-scenario-resources');
      const basicTasksStr = localStorage.getItem('basic-scenario-tasks');
      const complexResourcesStr = localStorage.getItem('complex-scenario-resources');
      const complexTasksStr = localStorage.getItem('complex-scenario-tasks');
      const complexProjectsStr = localStorage.getItem('complex-scenario-projects');
      const complexScheduleStr = localStorage.getItem('complex-scenario-schedule-result');

      // 解析数据
      const basicResources = basicResourcesStr ? JSON.parse(basicResourcesStr) : [];
      const basicTasks = basicTasksStr ? JSON.parse(basicTasksStr) : [];
      const complexResources = complexResourcesStr ? JSON.parse(complexResourcesStr) : [];
      const complexTasks = complexTasksStr ? JSON.parse(complexTasksStr) : [];
      const complexProjects = complexProjectsStr ? JSON.parse(complexProjectsStr) : [];
      const complexSchedule = complexScheduleStr ? JSON.parse(complexScheduleStr) : [];

      // 合并人员数据（去重）
      const allResources = [...basicResources, ...complexResources];
      const uniqueResources = Array.from(new Map(allResources.map(item => [item.id, item])).values());

      // 合并项目数据（去重）
      const uniqueProjects = Array.from(new Map(complexProjects.map(item => [item.id, item])).values());

      // 合并任务数据（去重）
      const allTasks = [...basicTasks, ...complexTasks];
      const uniqueTasks = Array.from(new Map(allTasks.map(item => [item.id, item])).values());

      // 生成排期数据
      const schedulesData: any[] = [];
      if (complexSchedule && complexSchedule.tasks) {
        complexSchedule.tasks.forEach((task: any, index: number) => {
          if (task.assignedResources && task.assignedResources.length > 0) {
            task.assignedResources.forEach((resource: any) => {
              schedulesData.push({
                'id': `sch-${Date.now()}-${index}-${resource.id}`,
                'task_id': task.id,
                'person_id': resource.id,
                'start_time': task.startTime ? new Date(task.startTime).toISOString() : '',
                'end_time': task.endTime ? new Date(task.endTime).toISOString() : '',
                'created_at': '',
                'updated_at': ''
              });
            });
          }
        });
      }

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表
      if (uniqueResources.length > 0) {
        const resourcesData = uniqueResources.map((resource: any) => ({
          'id': resource.id,
          'name': resource.name,
          'type': resource.type,
          'efficiency': resource.efficiency,
          'feishu_user': '',
          'total_hours': resource.totalHours || '0',
          'created_at': '',
          'updated_at': ''
        }));
        const resourcesSheet = XLSX.utils.json_to_sheet(resourcesData);
        XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表');
      }

      // 2. 项目表
      if (uniqueProjects.length > 0) {
        const projectsData = uniqueProjects.map((project: any) => ({
          'id': project.id,
          'name': project.name,
          'description': project.description || '',
          'start_date': project.startDate || '',
          'end_date': project.endDate || '',
          'status': project.status || '未开始',
          'created_at': '',
          'updated_at': ''
        }));
        const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
        XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表');
      }

      // 3. 任务表
      if (uniqueTasks.length > 0) {
        const tasksData = uniqueTasks.map((task: any) => ({
          'id': task.id,
          'name': task.name,
          'project_id': task.projectId || '',
          'type': task.type,
          'estimated_hours': task.estimatedHours,
          'actual_hours': task.actualHours || '0',
          'start_time': task.startTime ? new Date(task.startTime).toISOString() : '',
          'end_time': task.endTime ? new Date(task.endTime).toISOString() : '',
          'deadline': task.deadline ? new Date(task.deadline).toISOString() : '',
          'priority': task.priority,
          'assignee': task.assignedResources && task.assignedResources.length > 0 ? task.assignedResources[0].id : '',
          'dependencies': Array.isArray(task.dependencies) ? task.dependencies.join(',') : (task.dependencies || ''),
          'status': task.status || '未开始',
          'is_overdue': task.isOverdue ? 'true' : 'false',
          'feishu_version': task.feishuVersion || '0',
          'created_at': '',
          'updated_at': ''
        }));
        const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
        XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');
      }

      // 4. 排期表
      if (schedulesData.length > 0) {
        const schedulesSheet = XLSX.utils.json_to_sheet(schedulesData);
        XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表');
      }

      // 生成 Excel 文件
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      XLSX.writeFile(workbook, `项目排期系统数据导出_${timestamp}.xlsx`);

      // 显示统计信息
      const message = `成功导出系统数据！\n\n` +
        `人员: ${uniqueResources.length} 条\n` +
        `项目: ${uniqueProjects.length} 条\n` +
        `任务: ${uniqueTasks.length} 条\n` +
        `排期: ${schedulesData.length} 条`;
      alert(message);
    } catch (error) {
      console.error('导出系统数据失败:', error);
      alert('导出系统数据失败，请重试');
    } finally {
      setIsExportingSystemData(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel 模板生成器
        </CardTitle>
        <CardDescription>
          生成三种类型的 Excel 模板，帮助您快速配置飞书多维表
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 字段配置模板 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">1. 字段配置模板</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            包含所有表格的字段配置说明，用于创建表格时参考字段类型和设置
          </p>
          <Button
            onClick={generateExcelTemplate}
            disabled={isGenerating}
            variant="outline"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                生成中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                下载字段配置模板
              </>
            )}
          </Button>
        </div>

        <div className="border-t pt-3" />

        {/* 示例数据模板 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">2. 示例数据模板</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            包含示例人员、项目、任务和排期数据，可直接复制到飞书表格中测试同步功能
          </p>
          <Button
            onClick={generateDataTemplate}
            disabled={isGeneratingData}
            variant="outline"
            className="w-full"
          >
            {isGeneratingData ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                生成中...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                下载示例数据模板
              </>
            )}
          </Button>
        </div>

        <div className="border-t pt-3" />

        {/* 当前系统数据导出 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">3. 导出当前系统数据</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            从您当前系统中导出的人员、项目、任务和排期数据，可直接导入到飞书多维表
          </p>
          <Button
            onClick={exportSystemDataToExcel}
            disabled={isExportingSystemData}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isExportingSystemData ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                导出中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                导出当前系统数据
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
