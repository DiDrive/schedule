'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import { FEISHU_FIELD_IDS } from '@/lib/feishu-data-mapper';

export default function ExcelTemplateGenerator() {
  const [isExportingSystemData, setIsExportingSystemData] = useState(false);

  // 导出系统数据到飞书格式 Excel
  const exportSystemDataToFeishu = () => {
    setIsExportingSystemData(true);

    try {
      // 从 localStorage 读取系统数据
      const storedData = localStorage.getItem('projectScheduleSystem');
      if (!storedData) {
        alert('没有找到系统数据，请先在系统中添加一些人员、项目或任务');
        setIsExportingSystemData(false);
        return;
      }

      const systemData = JSON.parse(storedData);
      const { resources = [], projects = [], tasks = [] } = systemData;

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表数据
      if (resources.length > 0) {
        const resourcesData = resources.map((res: any) => ({
          [FEISHU_FIELD_IDS.resources.id]: res.id,
          [FEISHU_FIELD_IDS.resources.name]: res.name,
          [FEISHU_FIELD_IDS.resources.type]: res.workType === '平面' ? '平面设计' : res.workType === '后期' ? '后期制作' : '物料',
          [FEISHU_FIELD_IDS.resources.efficiency]: Number(res.efficiency || 1),
          [FEISHU_FIELD_IDS.resources.feishu_user]: '',
          [FEISHU_FIELD_IDS.resources.total_hours]: 0,
          [FEISHU_FIELD_IDS.resources.created_at]: '',
          [FEISHU_FIELD_IDS.resources.updated_at]: '',
        }));
        const resourcesSheet = XLSX.utils.json_to_sheet(resourcesData);
        XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表');
      }

      // 2. 项目表数据
      if (projects.length > 0) {
        const projectsData = projects.map((proj: any) => ({
          [FEISHU_FIELD_IDS.projects.id]: proj.id,
          [FEISHU_FIELD_IDS.projects.name]: proj.name,
          [FEISHU_FIELD_IDS.projects.description]: proj.description || '',
          [FEISHU_FIELD_IDS.projects.start_date]: proj.startDate ? proj.startDate.split(' ')[0] : '',
          [FEISHU_FIELD_IDS.projects.end_date]: proj.deadline ? proj.deadline.split(' ')[0] : '',
          [FEISHU_FIELD_IDS.projects.status]: '进行中',
          [FEISHU_FIELD_IDS.projects.created_at]: '',
          [FEISHU_FIELD_IDS.projects.updated_at]: '',
        }));
        const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
        XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表');
      }

      // 3. 任务表数据
      if (tasks.length > 0) {
        const tasksData = tasks.map((task: any) => ({
          [FEISHU_FIELD_IDS.tasks.id]: task.id,
          [FEISHU_FIELD_IDS.tasks.name]: task.name,
          [FEISHU_FIELD_IDS.tasks.project]: task.projectId || '',
          [FEISHU_FIELD_IDS.tasks.type]: task.workType === '平面' ? '平面设计' : task.workType === '后期' ? '后期制作' : '物料',
          [FEISHU_FIELD_IDS.tasks.estimated_hours]: task.estimatedHours,
          [FEISHU_FIELD_IDS.tasks.actual_hours]: task.actualHours || 0,
          [FEISHU_FIELD_IDS.tasks.start_time]: task.startTime || '',
          [FEISHU_FIELD_IDS.tasks.end_time]: task.endTime || '',
          [FEISHU_FIELD_IDS.tasks.deadline]: task.deadline || '',
          [FEISHU_FIELD_IDS.tasks.priority]: task.priority || '中',
          [FEISHU_FIELD_IDS.tasks.assignee]: task.assignedResources?.[0]?.name || '',
          [FEISHU_FIELD_IDS.tasks.dependencies]: task.dependencies?.join(', ') || '',
          [FEISHU_FIELD_IDS.tasks.status]: '未开始',
          [FEISHU_FIELD_IDS.tasks.is_overdue]: false,
          [FEISHU_FIELD_IDS.tasks.feishu_version]: 1,
          [FEISHU_FIELD_IDS.tasks.system_version]: 1,
          [FEISHU_FIELD_IDS.tasks.last_synced_at]: '',
          [FEISHU_FIELD_IDS.tasks.sync_source]: '系统',
          [FEISHU_FIELD_IDS.tasks.created_at]: '',
          [FEISHU_FIELD_IDS.tasks.updated_at]: '',
        }));
        const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
        XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');
      }

      // 如果没有任何数据，创建空模板
      if (resources.length === 0 && projects.length === 0 && tasks.length === 0) {
        // 创建空的人员表模板
        const emptyResources = [{
          [FEISHU_FIELD_IDS.resources.id]: 'res-001',
          [FEISHU_FIELD_IDS.resources.name]: '张三',
          [FEISHU_FIELD_IDS.resources.type]: '平面设计',
          [FEISHU_FIELD_IDS.resources.efficiency]: 1.0,
          [FEISHU_FIELD_IDS.resources.feishu_user]: '',
          [FEISHU_FIELD_IDS.resources.total_hours]: 0,
          [FEISHU_FIELD_IDS.resources.created_at]: '',
          [FEISHU_FIELD_IDS.resources.updated_at]: '',
        }];
        const emptyResourcesSheet = XLSX.utils.json_to_sheet(emptyResources);
        XLSX.utils.book_append_sheet(workbook, emptyResourcesSheet, '人员表');

        // 创建空的项目表模板
        const emptyProjects = [{
          [FEISHU_FIELD_IDS.projects.id]: 'proj-001',
          [FEISHU_FIELD_IDS.projects.name]: '示例项目',
          [FEISHU_FIELD_IDS.projects.description]: '项目描述',
          [FEISHU_FIELD_IDS.projects.start_date]: '2024-01-01',
          [FEISHU_FIELD_IDS.projects.end_date]: '2024-01-31',
          [FEISHU_FIELD_IDS.projects.status]: '进行中',
          [FEISHU_FIELD_IDS.projects.created_at]: '',
          [FEISHU_FIELD_IDS.projects.updated_at]: '',
        }];
        const emptyProjectsSheet = XLSX.utils.json_to_sheet(emptyProjects);
        XLSX.utils.book_append_sheet(workbook, emptyProjectsSheet, '项目表');

        // 创建空的任务表模板
        const emptyTasks = [{
          [FEISHU_FIELD_IDS.tasks.id]: 'task-001',
          [FEISHU_FIELD_IDS.tasks.name]: '示例任务',
          [FEISHU_FIELD_IDS.tasks.project]: '',
          [FEISHU_FIELD_IDS.tasks.type]: '平面设计',
          [FEISHU_FIELD_IDS.tasks.estimated_hours]: 8,
          [FEISHU_FIELD_IDS.tasks.actual_hours]: 0,
          [FEISHU_FIELD_IDS.tasks.start_time]: '2024-01-01 09:30:00',
          [FEISHU_FIELD_IDS.tasks.end_time]: '2024-01-01 18:30:00',
          [FEISHU_FIELD_IDS.tasks.deadline]: '2024-01-05 18:30:00',
          [FEISHU_FIELD_IDS.tasks.priority]: '高',
          [FEISHU_FIELD_IDS.tasks.assignee]: '',
          [FEISHU_FIELD_IDS.tasks.dependencies]: '',
          [FEISHU_FIELD_IDS.tasks.status]: '未开始',
          [FEISHU_FIELD_IDS.tasks.is_overdue]: false,
          [FEISHU_FIELD_IDS.tasks.feishu_version]: 1,
          [FEISHU_FIELD_IDS.tasks.system_version]: 1,
          [FEISHU_FIELD_IDS.tasks.last_synced_at]: '',
          [FEISHU_FIELD_IDS.tasks.sync_source]: '系统',
          [FEISHU_FIELD_IDS.tasks.created_at]: '',
          [FEISHU_FIELD_IDS.tasks.updated_at]: '',
        }];
        const emptyTasksSheet = XLSX.utils.json_to_sheet(emptyTasks);
        XLSX.utils.book_append_sheet(workbook, emptyTasksSheet, '任务表');
      }

      // 生成文件
      XLSX.writeFile(workbook, '飞书多维表数据.xlsx');
      alert('导出成功！请将 Excel 文件导入到飞书多维表中');
    } catch (error) {
      console.error('导出系统数据失败:', error);
      alert('导出系统数据失败');
    } finally {
      setIsExportingSystemData(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel 数据导出
        </CardTitle>
        <CardDescription>导出系统现有数据，可直接导入飞书多维表</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={exportSystemDataToFeishu}
          disabled={isExportingSystemData}
          className="w-full"
        >
          {isExportingSystemData ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              导出中...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              导出系统数据（可直接导入飞书）
            </>
          )}
        </Button>

        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p className="font-medium">使用说明：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>点击按钮导出系统数据到 Excel</li>
            <li>在飞书多维表中创建对应的数据表（人员、项目、任务）</li>
            <li>创建字段时，第一行就是字段名称，直接复制</li>
            <li>将 Excel 数据导入到飞书表格中</li>
            <li>配置关联关系（project 关联项目表）</li>
            <li>在系统中配置 Table ID 后即可同步</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
