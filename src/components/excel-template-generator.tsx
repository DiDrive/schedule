'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet } from 'lucide-react';

export default function ExcelTemplateGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);

  // 生成 Excel 模板
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
          '字段ID': 'project',
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
          '字段ID': 'system_version',
          '字段名称': '系统记录版本',
          '字段类型': '数字',
          '必填': '否',
          '说明': '版本号（冲突检测用）',
          '示例值': '0'
        },
        {
          '字段ID': 'last_synced_at',
          '字段名称': '最后同步时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '最后同步时间',
          '示例值': ''
        },
        {
          '字段ID': 'sync_source',
          '字段名称': '同步来源',
          '字段类型': '单选',
          '必填': '否',
          '说明': '同步来源（选项：系统、飞书、手动）',
          '示例值': '系统'
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
          '示例值': 'schedule-001'
        },
        {
          '字段ID': 'project',
          '字段名称': '项目',
          '字段类型': '关联记录',
          '必填': '否',
          '说明': '关联项目表的记录',
          '示例值': 'proj-001'
        },
        {
          '字段ID': 'name',
          '字段名称': '排期名称',
          '字段类型': '单行文本',
          '必填': '是',
          '说明': '排期名称',
          '示例值': '排期 2024-01-01'
        },
        {
          '字段ID': 'version',
          '字段名称': '排期版本',
          '字段类型': '数字',
          '必填': '否',
          '说明': '排期版本号',
          '示例值': '1'
        },
        {
          '字段ID': 'task_count',
          '字段名称': '任务总数',
          '字段类型': '数字',
          '必填': '否',
          '说明': '任务总数',
          '示例值': '10'
        },
        {
          '字段ID': 'total_hours',
          '字段名称': '总工时',
          '字段类型': '数字',
          '必填': '否',
          '说明': '总工时',
          '示例值': '80'
        },
        {
          '字段ID': 'utilization',
          '字段名称': '资源利用率',
          '字段类型': '百分比',
          '必填': '否',
          '说明': '资源利用率',
          '示例值': '85%'
        },
        {
          '字段ID': 'critical_path_count',
          '字段名称': '关键路径数量',
          '字段类型': '数字',
          '必填': '否',
          '说明': '关键路径任务数量',
          '示例值': '3'
        },
        {
          '字段ID': 'start_time',
          '字段名称': '排期开始时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '排期开始时间',
          '示例值': '2024-01-01 09:30'
        },
        {
          '字段ID': 'end_time',
          '字段名称': '排期结束时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '排期结束时间',
          '示例值': '2024-01-10 18:30'
        },
        {
          '字段ID': 'generated_at',
          '字段名称': '生成时间',
          '字段类型': '日期',
          '必填': '否',
          '说明': '排期生成时间',
          '示例值': ''
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel 字段配置模板
        </CardTitle>
        <CardDescription>
          下载包含所有表格字段配置的 Excel 模板，方便您在飞书中创建表格时参考
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={generateExcelTemplate}
          disabled={isGenerating}
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
              下载 Excel 模板
            </>
          )}
        </Button>
        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>模板包含以下内容：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>人员表（8个字段）</li>
            <li>项目表（8个字段）</li>
            <li>任务表（18个字段）</li>
            <li>排期表（12个字段）</li>
          </ul>
          <p className="mt-2">
            每个字段都包含：字段ID、字段名称、字段类型、是否必填、说明和示例值
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
