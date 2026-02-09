'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import { FEISHU_FIELD_IDS } from '@/lib/feishu-data-mapper';

type ScenarioType = 'basic' | 'complex';

interface ExcelTemplateGeneratorProps {
  scenario?: ScenarioType;
}

export default function ExcelTemplateGenerator({ scenario }: ExcelTemplateGeneratorProps) {
  const [isExportingSystemData, setIsExportingSystemData] = useState(false);

  // 导出基础场景数据到飞书格式 Excel
  const exportBasicScenarioData = () => {
    setIsExportingSystemData(true);

    try {
      // 从 localStorage 读取基础场景数据
      const basicResourcesStr = localStorage.getItem('basic-scenario-resources');
      const basicTasksStr = localStorage.getItem('basic-scenario-tasks');
      const basicScheduleStr = localStorage.getItem('basic-scenario-schedule-result');

      const basicResources = basicResourcesStr ? JSON.parse(basicResourcesStr) : [];
      const basicTasks = basicTasksStr ? JSON.parse(basicTasksStr) : [];
      const basicSchedule = basicScheduleStr ? JSON.parse(basicScheduleStr) : null;

      exportScenarioData('basic', basicResources, [], basicTasks, basicSchedule);
    } catch (error) {
      console.error('导出基础场景数据失败:', error);
      alert('导出失败，请查看控制台获取详细信息');
      setIsExportingSystemData(false);
    }
  };

  // 导出复杂场景数据到飞书格式 Excel
  const exportComplexScenarioData = () => {
    setIsExportingSystemData(true);

    try {
      // 从 localStorage 读取复杂场景数据
      const complexResourcesStr = localStorage.getItem('complex-scenario-resources');
      const complexProjectsStr = localStorage.getItem('complex-scenario-projects');
      const complexTasksStr = localStorage.getItem('complex-scenario-tasks');
      const complexScheduleStr = localStorage.getItem('complex-scenario-schedule-result');

      const complexResources = complexResourcesStr ? JSON.parse(complexResourcesStr) : [];
      const complexProjects = complexProjectsStr ? JSON.parse(complexProjectsStr) : [];
      const complexTasks = complexTasksStr ? JSON.parse(complexTasksStr) : [];
      const complexSchedule = complexScheduleStr ? JSON.parse(complexScheduleStr) : null;

      exportScenarioData('complex', complexResources, complexProjects, complexTasks, complexSchedule);
    } catch (error) {
      console.error('导出复杂场景数据失败:', error);
      alert('导出失败，请查看控制台获取详细信息');
      setIsExportingSystemData(false);
    }
  };

  // 统一的导出函数
  const exportScenarioData = (
    scenarioType: 'basic' | 'complex',
    resources: any[],
    projects: any[],
    tasks: any[],
    schedule: any
  ) => {
    console.log('=== 导出数据统计 ===');
    console.log('场景类型:', scenarioType);
    console.log('资源总数:', resources.length);
    console.log('项目总数:', projects.length);
    console.log('任务总数:', tasks.length);
    console.log('有排期结果:', !!schedule);

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 1. 人员表数据（只导出人力资源）
    const humanResources = resources.filter((res: any) => res.type === 'human');
    if (humanResources.length > 0) {
      const resourcesData = humanResources.map((res: any) => {
        const data: Record<string, any> = {};
        data[FEISHU_FIELD_IDS.resources.id] = res.id;
        data[FEISHU_FIELD_IDS.resources.name] = res.name;
        data[FEISHU_FIELD_IDS.resources.type] = res.workType === '平面' ? '平面设计' : res.workType === '后期' ? '后期制作' : '物料';
        return data;
      });
      const resourcesSheet = XLSX.utils.json_to_sheet(resourcesData);
      XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表');
    }

    // 2. 项目表数据（仅复杂场景）
    if (projects.length > 0) {
      const projectsData = projects.map((proj: any) => {
        const data: Record<string, any> = {};
        data[FEISHU_FIELD_IDS.projects.id] = proj.id;
        data[FEISHU_FIELD_IDS.projects.name] = proj.name;
        data[FEISHU_FIELD_IDS.projects.description] = proj.description || '';
        data[FEISHU_FIELD_IDS.projects.end_date] = proj.deadline ? proj.deadline.split(' ')[0] : '';
        data[FEISHU_FIELD_IDS.projects.status] = '进行中';
        return data;
      });
      const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
      XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表');
    }

    // 3. 任务表数据（任务管理数据，不包含排期信息）
    if (tasks.length > 0) {
      console.log('=== 导出任务数据 ===');
      console.log('任务总数:', tasks.length);

      const tasksData = tasks.map((task: any) => {
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
          [FEISHU_FIELD_IDS.tasks.deadline]: task.deadline || '',
          [FEISHU_FIELD_IDS.tasks.priority]: task.priority === 'urgent' || task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中',
          [FEISHU_FIELD_IDS.tasks.assignee]: '', // ★★★ 不包含排期信息（负责人）★★★
          [FEISHU_FIELD_IDS.tasks.dependencies]: task.dependencies?.join(', ') || '',
        };
      });
      const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表');
    }

    // 4. 排期表数据（排期结果表格，显示每个任务的具体排期信息）
    if (schedule && schedule.tasks && schedule.tasks.length > 0) {
      console.log('=== 导出排期数据 ===');
      console.log('排期名称:', scenarioType === 'basic' ? '基础场景排期' : `${projects[0]?.name || '复杂场景'}排期`);
      console.log('任务数:', schedule.tasks.length);
      console.log('总工时:', schedule.totalHours);

      // 创建资源ID到名称的映射
      const resourceMap = new Map(resources.map((res: any) => [res.id, res.name]));

      // 创建项目ID到名称的映射
      const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));

      // 导出排期结果表格数据（每个任务一行）
      const scheduleData = schedule.tasks.map((task: any) => {
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

        // 获取负责人名称
        let assignee = '';
        if (task.assignedResources && task.assignedResources.length > 0) {
          const resourceId = task.assignedResources[0];
          if (typeof resourceId === 'string') {
            assignee = resourceMap.get(resourceId) || '';
          } else if (typeof resourceId === 'object') {
            assignee = resourceId.name || '';
          }
        }

        // 计算实际工时（考虑效率）
        const resourceId = task.assignedResources?.[0];
        const resource = resources.find((r: any) => r.id === resourceId);
        const efficiency = resource?.efficiency || 1.0;
        const actualHours = task.estimatedHours / efficiency;

        return {
          [FEISHU_FIELD_IDS.schedules.id]: task.id,
          [FEISHU_FIELD_IDS.schedules.project]: projectMap.get(task.projectId) || '',
          [FEISHU_FIELD_IDS.schedules.type]: taskType,
          [FEISHU_FIELD_IDS.schedules.assignee]: assignee,
          [FEISHU_FIELD_IDS.schedules.start_time]: task.startDate ? new Date(task.startDate).toLocaleString('zh-CN') : '',
          [FEISHU_FIELD_IDS.schedules.end_time]: task.endDate ? new Date(task.endDate).toLocaleString('zh-CN') : '',
          [FEISHU_FIELD_IDS.schedules.deadline]: task.deadline ? task.deadline.split(' ')[0] : '',
          [FEISHU_FIELD_IDS.schedules.actual_hours]: actualHours.toFixed(2),
          [FEISHU_FIELD_IDS.schedules.status]: task.status === 'pending' ? '未开始' : task.status === 'in-progress' ? '进行中' : task.status === 'completed' ? '已完成' : '已暂停',
        };
      });
      const schedulesSheet = XLSX.utils.json_to_sheet(scheduleData);
      XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表');
    }

    // 生成文件
    const fileName = scenarioType === 'basic' ? '基础场景-飞书多维表数据.xlsx' : '复杂场景-飞书多维表数据.xlsx';
    XLSX.writeFile(workbook, fileName);

    // 显示导出摘要
    const scheduleInfo = schedule
      ? `\n排期信息：\n  任务数：${schedule.tasks?.length || 0}\n  总工时：${schedule.totalHours || 0}`
      : '\n⚠ 注意：当前没有排期结果';

    alert(`导出成功！\n\n场景：${scenarioType === 'basic' ? '基础场景' : '复杂场景'}\n人员：${resources.length} 个\n项目：${projects.length} 个\n任务：${tasks.length} 个${scheduleInfo}\n\n文件名：${fileName}`);

    setIsExportingSystemData(false);
  };

  const handleExport = () => {
    if (scenario === 'basic') {
      exportBasicScenarioData();
    } else {
      exportComplexScenarioData();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel 数据导出
        </CardTitle>
        <CardDescription>
          导出{scenario === 'basic' ? '基础场景' : '复杂场景'}数据，可直接导入飞书多维表
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleExport}
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
              导出{scenario === 'basic' ? '基础场景' : '复杂场景'}数据
            </>
          )}
        </Button>

        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p className="font-medium">导出说明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>人员表</strong>：系统中的所有人员信息（人员ID、姓名、工作类型）</li>
            <li><strong>任务表</strong>：任务管理中的数据（任务定义），不包含排期信息</li>
            <li><strong>排期表</strong>：排期结果表格（每个任务的具体排期信息）</li>
            {scenario === 'complex' && <li><strong>项目表</strong>：系统中的所有项目信息</li>}
          </ul>
          <p className="font-medium mt-3">使用说明：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>点击按钮导出数据到 Excel</li>
            <li>在飞书多维表中创建对应的数据表</li>
            <li>创建字段时，Excel 第一行就是字段名称</li>
            <li>将 Excel 数据导入到飞书表格中</li>
            <li>配置关联关系（所属项目关联项目表）</li>
            <li>在系统中配置 Table ID 后即可同步</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
