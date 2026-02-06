'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import { FEISHU_FIELD_IDS, FEISHU_OPTION_VALUES } from '@/lib/feishu-data-mapper';

// 字段类型定义
interface FieldConfig {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
  options?: string[];
  relatedTable?: string;
  exampleValue: string;
  description: string;
}

export default function ExcelTemplateGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [isExportingSystemData, setIsExportingSystemData] = useState(false);

  // 生成飞书表格字段配置 Excel（基于系统配置）
  const generateFeishuImportTemplate = () => {
    setIsGenerating(true);

    try {
      // 创建工作簿
      const workbook = XLSX.utils.book_new();

      // 1. 人员表字段配置
      const resourcesFields: FieldConfig[] = [
        {
          fieldId: FEISHU_FIELD_IDS.resources.id,
          fieldName: '人员ID',
          fieldType: 'text',
          isRequired: true,
          exampleValue: 'res-001',
          description: '系统自动生成的唯一标识',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.name,
          fieldName: '姓名',
          fieldType: 'text',
          isRequired: true,
          exampleValue: '张三',
          description: '人员姓名',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.type,
          fieldName: '类型',
          fieldType: 'singleSelect',
          isRequired: true,
          options: Object.keys(FEISHU_OPTION_VALUES.resourceType),
          exampleValue: '平面设计',
          description: '人员类型',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.efficiency,
          fieldName: '效率系数',
          fieldType: 'number',
          isRequired: true,
          exampleValue: '1.0',
          description: '工作效率系数（0.5-2.0）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.feishu_user,
          fieldName: '飞书用户',
          fieldType: 'text',
          isRequired: false,
          exampleValue: 'ou_xxx',
          description: '关联的飞书用户ID',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.total_hours,
          fieldName: '总工时',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '100',
          description: '累计工作时间（小时）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.created_at,
          fieldName: '创建时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录创建时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.resources.updated_at,
          fieldName: '更新时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录更新时间',
        },
      ];

      const resourcesSheetData = resourcesFields.map(field => ({
        '字段ID': field.fieldId,
        '字段名称': field.fieldName,
        '字段类型': field.fieldType,
        '必填': field.isRequired ? '是' : '否',
        '选项': field.options?.join(', ') || '',
        '关联表格': field.relatedTable || '',
        '说明': field.description,
        '示例值': field.exampleValue,
      }));
      const resourcesSheet = XLSX.utils.json_to_sheet(resourcesSheetData);
      XLSX.utils.book_append_sheet(workbook, resourcesSheet, '人员表字段配置');

      // 2. 项目表字段配置
      const projectsFields: FieldConfig[] = [
        {
          fieldId: FEISHU_FIELD_IDS.projects.id,
          fieldName: '项目ID',
          fieldType: 'text',
          isRequired: true,
          exampleValue: 'proj-001',
          description: '项目唯一标识',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.name,
          fieldName: '项目名称',
          fieldType: 'text',
          isRequired: true,
          exampleValue: '网站设计',
          description: '项目名称',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.description,
          fieldName: '描述',
          fieldType: 'text',
          isRequired: false,
          exampleValue: '企业官网设计项目',
          description: '项目描述',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.start_date,
          fieldName: '开始日期',
          fieldType: 'date',
          isRequired: false,
          exampleValue: '2024-01-01',
          description: '项目开始日期（不包含时间）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.end_date,
          fieldName: '结束日期',
          fieldType: 'date',
          isRequired: false,
          exampleValue: '2024-01-31',
          description: '项目结束日期（不包含时间）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.status,
          fieldName: '状态',
          fieldType: 'singleSelect',
          isRequired: false,
          options: Object.keys(FEISHU_OPTION_VALUES.projectStatus),
          exampleValue: '进行中',
          description: '项目状态',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.created_at,
          fieldName: '创建时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录创建时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.projects.updated_at,
          fieldName: '更新时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录更新时间',
        },
      ];

      const projectsSheetData = projectsFields.map(field => ({
        '字段ID': field.fieldId,
        '字段名称': field.fieldName,
        '字段类型': field.fieldType,
        '必填': field.isRequired ? '是' : '否',
        '选项': field.options?.join(', ') || '',
        '关联表格': field.relatedTable || '',
        '说明': field.description,
        '示例值': field.exampleValue,
      }));
      const projectsSheet = XLSX.utils.json_to_sheet(projectsSheetData);
      XLSX.utils.book_append_sheet(workbook, projectsSheet, '项目表字段配置');

      // 3. 任务表字段配置
      const tasksFields: FieldConfig[] = [
        {
          fieldId: FEISHU_FIELD_IDS.tasks.id,
          fieldName: '任务ID',
          fieldType: 'text',
          isRequired: true,
          exampleValue: 'task-001',
          description: '任务唯一标识',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.name,
          fieldName: '任务名称',
          fieldType: 'text',
          isRequired: true,
          exampleValue: '首页设计',
          description: '任务名称',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.project,
          fieldName: '项目',
          fieldType: 'link',
          isRequired: false,
          relatedTable: '项目表',
          exampleValue: '[关联记录]',
          description: '关联项目表的记录',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.type,
          fieldName: '类型',
          fieldType: 'singleSelect',
          isRequired: true,
          options: Object.keys(FEISHU_OPTION_VALUES.taskType),
          exampleValue: '平面设计',
          description: '任务类型',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.estimated_hours,
          fieldName: '预估工时',
          fieldType: 'number',
          isRequired: true,
          exampleValue: '8',
          description: '预估工作小时数',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.actual_hours,
          fieldName: '实际工时',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '10',
          description: '实际工作小时数',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.start_time,
          fieldName: '开始时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 09:30:00',
          description: '任务开始时间（包含时间）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.end_time,
          fieldName: '结束时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 18:30:00',
          description: '任务结束时间（包含时间）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.deadline,
          fieldName: '截止日期',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-05 18:30:00',
          description: '任务截止日期（默认18:30）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.priority,
          fieldName: '优先级',
          fieldType: 'singleSelect',
          isRequired: true,
          options: Object.keys(FEISHU_OPTION_VALUES.taskPriority),
          exampleValue: '高',
          description: '任务优先级',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.assignee,
          fieldName: '负责人',
          fieldType: 'person',
          isRequired: false,
          exampleValue: '@张三',
          description: '任务负责人（飞书用户）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.dependencies,
          fieldName: '依赖任务',
          fieldType: 'link',
          isRequired: false,
          relatedTable: '任务表',
          exampleValue: '[关联记录]',
          description: '依赖的其他任务（自关联）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.status,
          fieldName: '状态',
          fieldType: 'singleSelect',
          isRequired: true,
          options: Object.keys(FEISHU_OPTION_VALUES.taskStatus),
          exampleValue: '进行中',
          description: '任务状态',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.is_overdue,
          fieldName: '是否超期',
          fieldType: 'checkbox',
          isRequired: false,
          exampleValue: 'false',
          description: '是否超期',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.feishu_version,
          fieldName: '飞书记录版本',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '1',
          description: '版本号（冲突检测）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.system_version,
          fieldName: '系统记录版本',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '1',
          description: '版本号（冲突检测）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.last_synced_at,
          fieldName: '最后同步时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '最后同步时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.sync_source,
          fieldName: '同步来源',
          fieldType: 'singleSelect',
          isRequired: false,
          options: Object.keys(FEISHU_OPTION_VALUES.syncSource),
          exampleValue: '系统',
          description: '数据来源',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.created_at,
          fieldName: '创建时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录创建时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.tasks.updated_at,
          fieldName: '更新时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录更新时间',
        },
      ];

      const tasksSheetData = tasksFields.map(field => ({
        '字段ID': field.fieldId,
        '字段名称': field.fieldName,
        '字段类型': field.fieldType,
        '必填': field.isRequired ? '是' : '否',
        '选项': field.options?.join(', ') || '',
        '关联表格': field.relatedTable || '',
        '说明': field.description,
        '示例值': field.exampleValue,
      }));
      const tasksSheet = XLSX.utils.json_to_sheet(tasksSheetData);
      XLSX.utils.book_append_sheet(workbook, tasksSheet, '任务表字段配置');

      // 4. 排期表字段配置
      const schedulesFields: FieldConfig[] = [
        {
          fieldId: FEISHU_FIELD_IDS.schedules.id,
          fieldName: '排期ID',
          fieldType: 'text',
          isRequired: true,
          exampleValue: 'sch-001',
          description: '排期唯一标识',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.project,
          fieldName: '项目',
          fieldType: 'link',
          isRequired: false,
          relatedTable: '项目表',
          exampleValue: '[关联记录]',
          description: '关联项目表的记录',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.name,
          fieldName: '排期名称',
          fieldType: 'text',
          isRequired: true,
          exampleValue: '2024年1月排期',
          description: '排期名称',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.version,
          fieldName: '排期版本',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '1',
          description: '排期版本号',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.task_count,
          fieldName: '任务总数',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '10',
          description: '任务总数',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.total_hours,
          fieldName: '总工时',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '80',
          description: '总工时（小时）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.utilization,
          fieldName: '资源利用率',
          fieldType: 'percent',
          isRequired: false,
          exampleValue: '85%',
          description: '资源利用率（百分比）',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.critical_path_count,
          fieldName: '关键路径数量',
          fieldType: 'number',
          isRequired: false,
          exampleValue: '3',
          description: '关键路径任务数量',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.start_time,
          fieldName: '排期开始时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 09:30:00',
          description: '排期开始时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.end_time,
          fieldName: '排期结束时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-31 18:30:00',
          description: '排期结束时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.generated_at,
          fieldName: '生成时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '排期生成时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.created_at,
          fieldName: '创建时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录创建时间',
        },
        {
          fieldId: FEISHU_FIELD_IDS.schedules.updated_at,
          fieldName: '更新时间',
          fieldType: 'datetime',
          isRequired: false,
          exampleValue: '2024-01-01 00:00:00',
          description: '记录更新时间',
        },
      ];

      const schedulesSheetData = schedulesFields.map(field => ({
        '字段ID': field.fieldId,
        '字段名称': field.fieldName,
        '字段类型': field.fieldType,
        '必填': field.isRequired ? '是' : '否',
        '选项': field.options?.join(', ') || '',
        '关联表格': field.relatedTable || '',
        '说明': field.description,
        '示例值': field.exampleValue,
      }));
      const schedulesSheet = XLSX.utils.json_to_sheet(schedulesSheetData);
      XLSX.utils.book_append_sheet(workbook, schedulesSheet, '排期表字段配置');

      // 5. 添加使用说明
      const instructions = [
        { '步骤': '1', '操作': '在飞书中创建四个多维表格（人员、项目、任务、排期）', '说明': '每个表格一个数据表' },
        { '步骤': '2', '操作': '在每个表格中创建字段', '说明': '参考对应工作表的字段配置，严格按照字段ID创建' },
        { '步骤': '3', '操作': '设置字段类型', '说明': '注意：link 类型需要使用"关联"字段类型' },
        { '步骤': '4', '操作': '设置关联关系', '说明': 'project 字段关联到项目表，dependencies 字段关联到任务表' },
        { '步骤': '5', '操作': '配置单选选项', '说明': '根据"选项"列设置单选字段的选项，必须完全一致' },
        { '步骤': '6', '操作': '获取 Table ID', '说明': '从飞书表格 URL 中获取每个表格的 Table ID' },
        { '步骤': '7', '操作': '配置系统', '说明': '在系统中配置 App Token 和 Table ID' },
      ];
      const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, '使用说明');

      // 6. 添加字段类型说明
      const fieldTypeInstructions = [
        { '字段类型': 'text', '飞书类型': '单行文本', '说明': '文本数据' },
        { '字段类型': 'number', '飞书类型': '数字', '说明': '数值数据' },
        { '字段类型': 'singleSelect', '飞书类型': '单选', '说明': '从预设选项中选择一个' },
        { '字段类型': 'date', '飞书类型': '日期', '说明': '不包含时间的日期' },
        { '字段类型': 'datetime', '飞书类型': '日期', '说明': '包含时间的日期' },
        { '字段类型': 'person', '飞书类型': '人员', '说明': '飞书用户' },
        { '字段类型': 'checkbox', '飞书类型': '复选框', '说明': '布尔值（是/否）' },
        { '字段类型': 'link', '飞书类型': '关联', '说明': '关联到其他表格' },
        { '字段类型': 'percent', '飞书类型': '数字', '说明': '百分比（数字格式化为百分比）' },
      ];
      const fieldTypeSheet = XLSX.utils.json_to_sheet(fieldTypeInstructions);
      XLSX.utils.book_append_sheet(workbook, fieldTypeSheet, '字段类型说明');

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
        <CardDescription>生成飞书表格字段配置（基于系统当前配置）</CardDescription>
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
            <li>点击按钮下载 Excel 模板（基于系统当前配置）</li>
            <li>按照模板在飞书中创建表格和字段</li>
            <li>配置关联关系和单选选项</li>
            <li>在系统中配置 Table ID</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
