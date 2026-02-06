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

  // 生成飞书表格字段配置 Excel
  const generateFeishuImportTemplate = () => {
    setIsGenerating(true);

    try {
      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表（创建字段配置）
      const resourcesFields = [
        { '字段ID': 'id', '字段名称': '人员ID', '字段类型': 'text', '必填': '是', '说明': '系统自动生成的唯一标识', '示例值': 'res-001' },
        { '字段ID': 'name', '字段名称': '姓名', '字段类型': 'text', '必填': '是', '说明': '人员姓名', '示例值': '张三' },
        { '字段ID': 'type', '字段名称': '类型', '字段类型': 'singleSelect', '必填': '是', '说明': '人员类型', '选项': '平面设计,后期制作,物料', '示例值': '平面设计' },
        { '字段ID': 'efficiency', '字段名称': '效率系数', '字段类型': 'number', '必填': '是', '说明': '工作效率系数（0.5-2.0）', '示例值': '1.0' },
        { '字段ID': 'feishu_user', '字段名称': '飞书用户', '字段类型': 'text', '必填': '否', '说明': '关联的飞书用户ID', '示例值': 'ou_xxx' },
        { '字段ID': 'total_hours', '字段名称': '总工时', '字段类型': 'number', '必填': '否', '说明': '累计工作时间（小时）', '示例值': '100' },
        { '字段ID': 'created_at', '字段名称': '创建时间', '字段类型': 'datetime', '必填': '否', '说明': '记录创建时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'updated_at', '字段名称': '更新时间', '字段类型': 'datetime', '必填': '否', '说明': '记录更新时间', '示例值': '2024-01-01 00:00:00' },
      ];
      const resourcesSheet = XLSX.utils.json_to_sheet(resourcesFields);
      XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表字段配置');

      // 2. 项目表（创建字段配置）
      const projectsFields = [
        { '字段ID': 'id', '字段名称': '项目ID', '字段类型': 'text', '必填': '是', '说明': '项目唯一标识', '示例值': 'proj-001' },
        { '字段ID': 'name', '字段名称': '项目名称', '字段类型': 'text', '必填': '是', '说明': '项目名称', '示例值': '网站设计' },
        { '字段ID': 'description', '字段名称': '描述', '字段类型': 'text', '必填': '否', '说明': '项目描述', '示例值': '企业官网设计项目' },
        { '字段ID': 'start_date', '字段名称': '开始日期', '字段类型': 'datetime', '必填': '否', '说明': '项目开始日期', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'end_date', '字段名称': '结束日期', '字段类型': 'datetime', '必填': '否', '说明': '项目结束日期', '示例值': '2024-01-31 00:00:00' },
        { '字段ID': 'status', '字段名称': '状态', '字段类型': 'singleSelect', '必填': '否', '说明': '项目状态', '选项': '未开始,进行中,已完成,已暂停', '示例值': '进行中' },
        { '字段ID': 'created_at', '字段名称': '创建时间', '字段类型': 'datetime', '必填': '否', '说明': '记录创建时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'updated_at', '字段名称': '更新时间', '字段类型': 'datetime', '必填': '否', '说明': '记录更新时间', '示例值': '2024-01-01 00:00:00' },
      ];
      const projectsSheet = XLSX.utils.json_to_sheet(projectsFields);
      XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表字段配置');

      // 3. 任务表（创建字段配置）
      const tasksFields = [
        { '字段ID': 'id', '字段名称': '任务ID', '字段类型': 'text', '必填': '是', '说明': '任务唯一标识', '示例值': 'task-001' },
        { '字段ID': 'name', '字段名称': '任务名称', '字段类型': 'text', '必填': '是', '说明': '任务名称', '示例值': '首页设计' },
        { '字段ID': 'project', '字段名称': '项目', '字段类型': 'link', '必填': '否', '说明': '关联项目表', '关联表格': '项目表' },
        { '字段ID': 'type', '字段名称': '类型', '字段类型': 'singleSelect', '必填': '是', '说明': '任务类型', '选项': '平面设计,后期制作,物料', '示例值': '平面设计' },
        { '字段ID': 'estimated_hours', '字段名称': '预估工时', '字段类型': 'number', '必填': '是', '说明': '预估工作小时数', '示例值': '8' },
        { '字段ID': 'actual_hours', '字段名称': '实际工时', '字段类型': 'number', '必填': '否', '说明': '实际工作小时数', '示例值': '10' },
        { '字段ID': 'start_time', '字段名称': '开始时间', '字段类型': 'datetime', '必填': '否', '说明': '任务开始时间', '示例值': '2024-01-01 09:30:00' },
        { '字段ID': 'end_time', '字段名称': '结束时间', '字段类型': 'datetime', '必填': '否', '说明': '任务结束时间', '示例值': '2024-01-01 18:30:00' },
        { '字段ID': 'deadline', '字段名称': '截止日期', '字段类型': 'datetime', '必填': '否', '说明': '任务截止日期（默认18:30）', '示例值': '2024-01-05 18:30:00' },
        { '字段ID': 'priority', '字段名称': '优先级', '字段类型': 'singleSelect', '必填': '是', '说明': '任务优先级', '选项': '高,中,低', '示例值': '高' },
        { '字段ID': 'assignee', '字段名称': '负责人', '字段类型': 'person', '必填': '否', '说明': '任务负责人（飞书用户）', '示例值': '@张三' },
        { '字段ID': 'dependencies', '字段名称': '依赖任务', '字段类型': 'link', '必填': '否', '说明': '依赖的其他任务', '关联表格': '任务表' },
        { '字段ID': 'status', '字段名称': '状态', '字段类型': 'singleSelect', '必填': '是', '说明': '任务状态', '选项': '未开始,进行中,已完成,已暂停,已超期', '示例值': '进行中' },
        { '字段ID': 'is_overdue', '字段名称': '是否超期', '字段类型': 'checkbox', '必填': '否', '说明': '是否超期', '示例值': 'false' },
        { '字段ID': 'feishu_version', '字段名称': '飞书记录版本', '字段类型': 'number', '必填': '否', '说明': '版本号（冲突检测）', '示例值': '1' },
        { '字段ID': 'system_version', '字段名称': '系统记录版本', '字段类型': 'number', '必填': '否', '说明': '版本号（冲突检测）', '示例值': '1' },
        { '字段ID': 'last_synced_at', '字段名称': '最后同步时间', '字段类型': 'datetime', '必填': '否', '说明': '最后同步时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'sync_source', '字段名称': '同步来源', '字段类型': 'singleSelect', '必填': '否', '说明': '数据来源', '选项': '系统,飞书,手动', '示例值': '系统' },
        { '字段ID': 'created_at', '字段名称': '创建时间', '字段类型': 'datetime', '必填': '否', '说明': '记录创建时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'updated_at', '字段名称': '更新时间', '字段类型': 'datetime', '必填': '否', '说明': '记录更新时间', '示例值': '2024-01-01 00:00:00' },
      ];
      const tasksSheet = XLSX.utils.json_to_sheet(tasksFields);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表字段配置');

      // 4. 排期表（创建字段配置）
      const schedulesFields = [
        { '字段ID': 'id', '字段名称': '排期ID', '字段类型': 'text', '必填': '是', '说明': '排期唯一标识', '示例值': 'sch-001' },
        { '字段ID': 'project', '字段名称': '项目', '字段类型': 'link', '必填': '否', '说明': '关联项目表', '关联表格': '项目表' },
        { '字段ID': 'name', '字段名称': '排期名称', '字段类型': 'text', '必填': '是', '说明': '排期名称', '示例值': '2024年1月排期' },
        { '字段ID': 'version', '字段名称': '排期版本', '字段类型': 'number', '必填': '否', '说明': '排期版本号', '示例值': '1' },
        { '字段ID': 'task_count', '字段名称': '任务总数', '字段类型': 'number', '必填': '否', '说明': '任务总数', '示例值': '10' },
        { '字段ID': 'total_hours', '字段名称': '总工时', '字段类型': 'number', '必填': '否', '说明': '总工时（小时）', '示例值': '80' },
        { '字段ID': 'utilization', '字段名称': '资源利用率', '字段类型': 'percent', '必填': '否', '说明': '资源利用率（百分比）', '示例值': '85%' },
        { '字段ID': 'critical_path_count', '字段名称': '关键路径数量', '字段类型': 'number', '必填': '否', '说明': '关键路径任务数量', '示例值': '3' },
        { '字段ID': 'start_time', '字段名称': '排期开始时间', '字段类型': 'datetime', '必填': '否', '说明': '排期开始时间', '示例值': '2024-01-01 09:30:00' },
        { '字段ID': 'end_time', '字段名称': '排期结束时间', '字段类型': 'datetime', '必填': '否', '说明': '排期结束时间', '示例值': '2024-01-31 18:30:00' },
        { '字段ID': 'generated_at', '字段名称': '生成时间', '字段类型': 'datetime', '必填': '否', '说明': '排期生成时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'created_at', '字段名称': '创建时间', '字段类型': 'datetime', '必填': '否', '说明': '记录创建时间', '示例值': '2024-01-01 00:00:00' },
        { '字段ID': 'updated_at', '字段名称': '更新时间', '字段类型': 'datetime', '必填': '否', '说明': '记录更新时间', '示例值': '2024-01-01 00:00:00' },
      ];
      const schedulesSheet = XLSX.utils.json_to_sheet(schedulesFields);
      XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表字段配置');

      // 5. 添加使用说明
      const instructions = [
        { '步骤': '1', '操作': '在飞书中创建四个多维表格（人员、项目、任务、排期）', '说明': '每个表格一个数据表' },
        { '步骤': '2', '操作': '在每个表格中创建字段', '说明': '参考对应工作表的字段配置' },
        { '步骤': '3', '操作': '设置字段类型', '说明': '注意：link 类型需要使用"关联"字段类型' },
        { '步骤': '4', '操作': '设置关联关系', '说明': 'project 字段关联到项目表，dependencies 字段关联到任务表' },
        { '步骤': '5', '操作': '配置单选选项', '说明': '根据"选项"列设置单选字段的选项' },
        { '步骤': '6', '操作': '获取 Table ID', '说明': '从飞书表格 URL 中获取每个表格的 Table ID' },
        { '步骤': '7', '操作': '配置系统', '说明': '在系统中配置 App Token 和 Table ID' },
      ];
      const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, '使用说明');

      // 生成文件
      XLSX.writeFile(workbook, '飞书多维表字段配置.xlsx');
    } catch (error) {
      console.error('生成 Excel 模板失败:', error);
      alert('生成 Excel 模板失败');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel 模板工具
        </CardTitle>
        <CardDescription>生成飞书表格字段配置和系统数据导出</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={generateFeishuImportTemplate}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              下载飞书表格字段配置
            </>
          )}
        </Button>

        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p className="font-medium">使用说明：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>点击按钮下载 Excel 模板</li>
            <li>按照模板在飞书中创建表格和字段</li>
            <li>配置关联关系和单选选项</li>
            <li>在系统中配置 Table ID</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
