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
      // 从 localStorage 读取系统数据（分场景存储）
      const basicResourcesStr = localStorage.getItem('basic-scenario-resources');
      const basicTasksStr = localStorage.getItem('basic-scenario-tasks');
      const basicScheduleStr = localStorage.getItem('basic-scenario-schedule-result');
      const complexResourcesStr = localStorage.getItem('complex-scenario-resources');
      const complexProjectsStr = localStorage.getItem('complex-scenario-projects');
      const complexTasksStr = localStorage.getItem('complex-scenario-tasks');
      const complexScheduleStr = localStorage.getItem('complex-scenario-schedule-result');

      // 解析数据
      const basicResources = basicResourcesStr ? JSON.parse(basicResourcesStr) : [];
      const basicTasksDef = basicTasksStr ? JSON.parse(basicTasksStr) : []; // 任务定义
      const basicSchedule = basicScheduleStr ? JSON.parse(basicScheduleStr) : null;
      const complexResources = complexResourcesStr ? JSON.parse(complexResourcesStr) : [];
      const complexProjects = complexProjectsStr ? JSON.parse(complexProjectsStr) : [];
      const complexTasksDef = complexTasksStr ? JSON.parse(complexTasksStr) : []; // 任务定义
      const complexSchedule = complexScheduleStr ? JSON.parse(complexScheduleStr) : null;

      // ★★★ 任务处理：使用所有任务定义（包含未排期的任务）★★★
      const allTasks = [...basicTasksDef, ...complexTasksDef].filter((task, index, self) =>
        index === self.findIndex(t => t.id === task.id)
      );

      // ★★★ 创建任务ID到排期任务的映射（用于获取排期信息）★★★
      const scheduledTaskMap = new Map<string, any>();
      if (basicSchedule?.tasks) {
        basicSchedule.tasks.forEach((t: any) => scheduledTaskMap.set(t.id, t));
      }
      if (complexSchedule?.tasks) {
        complexSchedule.tasks.forEach((t: any) => scheduledTaskMap.set(t.id, t));
      }

      // 合并所有资源（去重）
      const allResources = [...basicResources, ...complexResources].filter((res, index, self) =>
        index === self.findIndex(r => r.id === res.id)
      );

      // 合并所有项目
      const allProjects = [...complexProjects];

      // 合并所有排期结果（排期结果可能是对象，包含数组）
      const allSchedules: any[] = [];
      if (basicSchedule && basicSchedule.tasks) {
        allSchedules.push(basicSchedule);
      }
      if (complexSchedule && complexSchedule.tasks) {
        allSchedules.push(complexSchedule);
      }

      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 数据检查和统计
      console.log('=== 导出数据统计 ===');
      console.log('资源总数:', allResources.length);
      console.log('项目总数:', allProjects.length);
      console.log('任务总数:', allTasks.length);
      console.log('排期总数:', allSchedules.length);
      console.log('排期任务数:', allSchedules.reduce((sum, s) => sum + (s.tasks?.length || 0), 0));

      // 检查是否有排期结果
      const hasSchedule = allSchedules.length > 0 && allSchedules.some(s => s.tasks && s.tasks.length > 0);
      console.log('有排期结果:', hasSchedule);

      // 如果没有任何数据，创建空模板
      if (allResources.length === 0 && allProjects.length === 0 && allTasks.length === 0 && allSchedules.length === 0) {
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

        // 创建空的排期表模板
        const emptySchedules = [{
          [FEISHU_FIELD_IDS.schedules.id]: 'sch-001',
          [FEISHU_FIELD_IDS.schedules.project]: '',
          [FEISHU_FIELD_IDS.schedules.name]: '示例排期',
          [FEISHU_FIELD_IDS.schedules.version]: 1,
          [FEISHU_FIELD_IDS.schedules.task_count]: 1,
          [FEISHU_FIELD_IDS.schedules.total_hours]: 8,
          [FEISHU_FIELD_IDS.schedules.utilization]: 100,
          [FEISHU_FIELD_IDS.schedules.critical_path_count]: 0,
          [FEISHU_FIELD_IDS.schedules.start_time]: '2024-01-01 09:30:00',
          [FEISHU_FIELD_IDS.schedules.end_time]: '2024-01-01 18:30:00',
          [FEISHU_FIELD_IDS.schedules.generated_at]: '2024-01-01 00:00:00',
          [FEISHU_FIELD_IDS.schedules.created_at]: '',
          [FEISHU_FIELD_IDS.schedules.updated_at]: '',
        }];
        const emptySchedulesSheet = XLSX.utils.json_to_sheet(emptySchedules);
        XLSX.utils.book_append_sheet(workbook, emptySchedulesSheet, '排期表');

        // 生成文件
        XLSX.writeFile(workbook, '飞书多维表数据.xlsx');
        alert('导出成功！生成了示例数据模板。请将 Excel 文件导入到飞书多维表中');
        setIsExportingSystemData(false);
        return;
      }

      // 1. 人员表数据
      if (allResources.length > 0) {
        const resourcesData = allResources.map((res: any) => ({
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
      if (allProjects.length > 0) {
        const projectsData = allProjects.map((proj: any) => ({
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
      if (allTasks.length > 0) {
        // 创建资源ID到名称的映射
        const resourceMap = new Map(allResources.map((res: any) => [res.id, res.name]));
        
        console.log('=== 导出任务数据 ===');
        console.log('任务定义总数:', allTasks.length);
        console.log('排期任务数:', scheduledTaskMap.size);
        console.log('未排期任务数:', allTasks.length - scheduledTaskMap.size);
        
        const tasksData = allTasks.map((task: any) => {
          // ★★★ 从排期结果中获取任务的排期信息（如果有）★★★
          const scheduledTask = scheduledTaskMap.get(task.id);
          
          // 获取分配的资源名称
          let assignee = '';
          let assignedResources = task.assignedResources || [];
          let startDate = task.startDate;
          let endDate = task.endDate;
          
          // 如果有排期结果，使用排期结果中的信息
          if (scheduledTask) {
            assignedResources = scheduledTask.assignedResources || [];
            startDate = scheduledTask.startDate;
            endDate = scheduledTask.endDate;
          }
          
          if (assignedResources.length > 0) {
            if (typeof assignedResources[0] === 'string') {
              // 如果是资源ID，从映射中获取名称
              assignee = resourceMap.get(assignedResources[0]) || '';
            } else if (typeof assignedResources[0] === 'object') {
              // 如果是资源对象，直接获取名称
              assignee = assignedResources[0].name || '';
            }
          }
          
          // 转换任务类型
          let taskType = '物料';
          if (task.taskType === '平面') {
            taskType = '平面设计';
          } else if (task.taskType === '后期') {
            taskType = '后期制作';
          } else if (task.workType === '平面') {
            taskType = '平面设计';
          } else if (task.workType === '后期') {
            taskType = '后期制作';
          } else if (task.workType === '物料' || task.taskType === '物料') {
            taskType = '物料';
          }
          
          return {
            [FEISHU_FIELD_IDS.tasks.id]: task.id,
            [FEISHU_FIELD_IDS.tasks.name]: task.name,
            [FEISHU_FIELD_IDS.tasks.project]: task.projectId || '',
            [FEISHU_FIELD_IDS.tasks.type]: taskType,
            [FEISHU_FIELD_IDS.tasks.estimated_hours]: task.estimatedHours || 0,
            [FEISHU_FIELD_IDS.tasks.actual_hours]: task.actualHours || 0,
            [FEISHU_FIELD_IDS.tasks.start_time]: startDate ? new Date(startDate).toISOString().slice(0, 19).replace('T', ' ') : '',
            [FEISHU_FIELD_IDS.tasks.end_time]: endDate ? new Date(endDate).toISOString().slice(0, 19).replace('T', ' ') : '',
            [FEISHU_FIELD_IDS.tasks.deadline]: task.deadline || '',
            [FEISHU_FIELD_IDS.tasks.priority]: task.priority || '中',
            [FEISHU_FIELD_IDS.tasks.assignee]: assignee,
            [FEISHU_FIELD_IDS.tasks.dependencies]: task.dependencies?.join(', ') || '',
            [FEISHU_FIELD_IDS.tasks.status]: task.status === 'pending' ? '未开始' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '未开始',
            [FEISHU_FIELD_IDS.tasks.is_overdue]: task.isOverdue || false,
            [FEISHU_FIELD_IDS.tasks.feishu_version]: 1,
            [FEISHU_FIELD_IDS.tasks.system_version]: 1,
            [FEISHU_FIELD_IDS.tasks.last_synced_at]: '',
            [FEISHU_FIELD_IDS.tasks.sync_source]: '系统',
            [FEISHU_FIELD_IDS.tasks.created_at]: '',
            [FEISHU_FIELD_IDS.tasks.updated_at]: '',
          };
        });
        const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
        XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');
      }

      // 4. 排期表数据（每次排期结果作为一条记录）
      if (allSchedules.length > 0) {
        console.log('=== 导出排期数据 ===');
        console.log('排期总数:', allSchedules.length);
        
        const schedulesData = allSchedules.map((sch: any, index: number) => {
          // 计算资源利用率平均值
          const utilizationValues = Object.values(sch.resourceUtilization || {});
          const avgUtilization = utilizationValues.length > 0
            ? utilizationValues.reduce((sum: number, val: number) => sum + val, 0) / utilizationValues.length
            : 0;

          // 获取最早和最晚任务时间
          const taskTimes = (sch.tasks || []).map((t: any) => {
            const time = t.startDate; // 排期算法使用的是 startDate
            return time ? new Date(time).getTime() : 0;
          }).filter(t => t > 0);

          console.log(`排期 ${index}:`);
          console.log(`  名称: ${index === 0 ? '基础场景排期' : (sch.projects && sch.projects.length > 0 ? sch.projects[0].name + '排期' : '复杂场景排期')}`);
          console.log(`  任务数: ${(sch.tasks || []).length}`);
          console.log(`  有效时间数: ${taskTimes.length}`);
          console.log(`  总工时: ${sch.totalHours}`);
          console.log(`  资源利用率: ${avgUtilization}`);
          console.log(`  关键路径数: ${(sch.criticalPath || []).length}`);
          
          if (taskTimes.length > 0) {
            const minTime = Math.min(...taskTimes);
            const maxTime = Math.max(...taskTimes);
            console.log(`  最早开始: ${new Date(minTime).toLocaleString()}`);
            console.log(`  最晚结束: ${new Date(maxTime).toLocaleString()}`);
          }
          
          const startTime = taskTimes.length > 0 ? Math.min(...taskTimes) : 0;
          const endTime = taskTimes.length > 0 ? Math.max(...taskTimes) : 0;

          // 如果是复杂场景，获取第一个项目的ID
          let projectId = '';
          if (sch.projects && sch.projects.length > 0) {
            projectId = sch.projects[0].id;
          }

          // 排期名称
          let scheduleName = '复杂场景排期';
          if (index === 0) {
            scheduleName = '基础场景排期';
          } else if (sch.projects && sch.projects.length > 0) {
            scheduleName = `${sch.projects[0].name}排期`;
          }

          return {
            [FEISHU_FIELD_IDS.schedules.id]: `schedule-${Date.now()}-${index}`,
            [FEISHU_FIELD_IDS.schedules.project]: projectId,
            [FEISHU_FIELD_IDS.schedules.name]: scheduleName,
            [FEISHU_FIELD_IDS.schedules.version]: 1,
            [FEISHU_FIELD_IDS.schedules.task_count]: (sch.tasks || []).length,
            [FEISHU_FIELD_IDS.schedules.total_hours]: sch.totalHours || 0,
            [FEISHU_FIELD_IDS.schedules.utilization]: Math.round(avgUtilization * 100) / 100,
            [FEISHU_FIELD_IDS.schedules.critical_path_count]: (sch.criticalPath || []).length,
            [FEISHU_FIELD_IDS.schedules.start_time]: startTime > 0 
              ? new Date(startTime).toISOString().slice(0, 19).replace('T', ' ') 
              : '',
            [FEISHU_FIELD_IDS.schedules.end_time]: endTime > 0 
              ? new Date(endTime).toISOString().slice(0, 19).replace('T', ' ') 
              : '',
            [FEISHU_FIELD_IDS.schedules.generated_at]: new Date().toISOString().slice(0, 19).replace('T', ' '),
            [FEISHU_FIELD_IDS.schedules.created_at]: '',
            [FEISHU_FIELD_IDS.schedules.updated_at]: '',
          };
        });
        const schedulesSheet = XLSX.utils.json_to_sheet(schedulesData);
        XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表');
      }

      // 生成文件
      XLSX.writeFile(workbook, '飞书多维表数据.xlsx');
      
      // 显示导出摘要
      const scheduledTasksCount = allSchedules.reduce((sum, s) => sum + (s.tasks?.length || 0), 0);
      const summary = `导出成功！\n\n人员: ${allResources.length} 个\n项目: ${allProjects.length} 个\n任务: ${allTasks.length} 个 (已排期: ${scheduledTasksCount} 个)\n排期: ${allSchedules.length} 个`;
      
      if (allSchedules.length > 0) {
        const scheduleSummary = allSchedules.map((s: any, i: number) => {
          const name = i === 0 ? '基础场景' : (s.projects && s.projects.length > 0 ? s.projects[0].name : '复杂场景');
          return `${name}: ${s.tasks?.length || 0} 任务, ${s.totalHours || 0} 工时`;
        }).join('\n');
        
        const unscheduledNotice = allTasks.length > scheduledTasksCount 
          ? `\n\n⚠ 注意: 有 ${allTasks.length - scheduledTasksCount} 个任务未排期（可能是物料任务或未生成的排期）` 
          : '';
        
        alert(`${summary}\n\n排期详情:\n${scheduleSummary}${unscheduledNotice}\n\n请将 Excel 文件导入到飞书多维表中`);
      } else {
        alert(`${summary}\n\n⚠ 注意: 当前没有排期结果，导出的是任务定义数据。\n如需导出排期结果，请先在系统中生成排期。\n\n请将 Excel 文件导入到飞书多维表中`);
      }
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
