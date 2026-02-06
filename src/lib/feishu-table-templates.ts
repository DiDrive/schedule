/**
 * 飞书表格配置模板导出器
 * 帮助用户生成表格结构配置，可以手动在飞书中创建表格时参考
 */

export interface TableField {
  name: string;
  fieldId: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
}

export interface TableTemplate {
  tableName: string;
  description: string;
  fields: TableField[];
}

// 人员表模板
export const resourcesTableTemplate: TableTemplate = {
  tableName: '人员',
  description: '人员信息表，包含人员基本信息、类型和效率系数',
  fields: [
    {
      name: '人员ID',
      fieldId: 'id',
      type: 'text',
      required: true,
      description: '系统自动生成的唯一标识'
    },
    {
      name: '姓名',
      fieldId: 'name',
      type: 'text',
      required: true,
      description: '人员姓名'
    },
    {
      name: '类型',
      fieldId: 'type',
      type: 'select',
      required: true,
      options: ['平面设计', '后期制作', '物料'],
      description: '人员类型'
    },
    {
      name: '效率系数',
      fieldId: 'efficiency',
      type: 'number',
      required: true,
      description: '效率系数（0.5-2.0）'
    },
    {
      name: '飞书用户ID',
      fieldId: 'feishu_user',
      type: 'person',
      required: false,
      description: '对应的飞书用户'
    },
    {
      name: '累计工时',
      fieldId: 'total_hours',
      type: 'number',
      required: false,
      description: '累计工作小时数'
    },
    {
      name: '创建时间',
      fieldId: 'created_at',
      type: 'datetime',
      required: false,
      description: '记录创建时间'
    },
    {
      name: '更新时间',
      fieldId: 'updated_at',
      type: 'datetime',
      required: false,
      description: '记录更新时间'
    }
  ]
};

// 项目表模板
export const projectsTableTemplate: TableTemplate = {
  tableName: '项目',
  description: '项目信息表，包含项目基本信息和状态',
  fields: [
    {
      name: '项目ID',
      fieldId: 'id',
      type: 'text',
      required: true,
      description: '项目唯一标识'
    },
    {
      name: '项目名称',
      fieldId: 'name',
      type: 'text',
      required: true,
      description: '项目名称'
    },
    {
      name: '描述',
      fieldId: 'description',
      type: 'text',
      required: false,
      description: '项目描述'
    },
    {
      name: '开始日期',
      fieldId: 'start_date',
      type: 'datetime',
      required: false,
      description: '项目开始日期'
    },
    {
      name: '结束日期',
      fieldId: 'end_date',
      type: 'datetime',
      required: false,
      description: '项目结束日期'
    },
    {
      name: '状态',
      fieldId: 'status',
      type: 'select',
      required: false,
      options: ['未开始', '进行中', '已完成', '已暂停'],
      description: '项目状态'
    },
    {
      name: '创建时间',
      fieldId: 'created_at',
      type: 'datetime',
      required: false,
      description: '记录创建时间'
    },
    {
      name: '更新时间',
      fieldId: 'updated_at',
      type: 'datetime',
      required: false,
      description: '记录更新时间'
    }
  ]
};

// 任务表模板
export const tasksTableTemplate: TableTemplate = {
  tableName: '任务',
  description: '任务信息表，包含任务详情、负责人、依赖关系等',
  fields: [
    {
      name: '任务ID',
      fieldId: 'id',
      type: 'text',
      required: true,
      description: '任务唯一标识'
    },
    {
      name: '任务名称',
      fieldId: 'name',
      type: 'text',
      required: true,
      description: '任务名称'
    },
    {
      name: '项目',
      fieldId: 'project',
      type: 'link',
      required: false,
      description: '关联项目表的记录'
    },
    {
      name: '类型',
      fieldId: 'type',
      type: 'select',
      required: true,
      options: ['平面设计', '后期制作', '物料'],
      description: '任务类型'
    },
    {
      name: '预估工时',
      fieldId: 'estimated_hours',
      type: 'number',
      required: true,
      description: '预估工作小时数'
    },
    {
      name: '实际工时',
      fieldId: 'actual_hours',
      type: 'number',
      required: false,
      description: '实际工作小时数'
    },
    {
      name: '开始时间',
      fieldId: 'start_time',
      type: 'datetime',
      required: false,
      description: '任务开始时间'
    },
    {
      name: '结束时间',
      fieldId: 'end_time',
      type: 'datetime',
      required: false,
      description: '任务结束时间'
    },
    {
      name: '截止日期',
      fieldId: 'deadline',
      type: 'datetime',
      required: false,
      description: '任务截止日期'
    },
    {
      name: '优先级',
      fieldId: 'priority',
      type: 'select',
      required: true,
      options: ['高', '中', '低'],
      description: '任务优先级'
    },
    {
      name: '负责人',
      fieldId: 'assignee',
      type: 'person',
      required: false,
      description: '任务负责人'
    },
    {
      name: '依赖任务',
      fieldId: 'dependencies',
      type: 'link',
      required: false,
      description: '依赖的其他任务（自关联）'
    },
    {
      name: '状态',
      fieldId: 'status',
      type: 'select',
      required: true,
      options: ['未开始', '进行中', '已完成', '已暂停', '已超期'],
      description: '任务状态'
    },
    {
      name: '是否超期',
      fieldId: 'is_overdue',
      type: 'checkbox',
      required: false,
      description: '是否超期'
    },
    {
      name: '飞书记录版本',
      fieldId: 'feishu_version',
      type: 'number',
      required: false,
      description: '版本号（冲突检测用）'
    },
    {
      name: '系统记录版本',
      fieldId: 'system_version',
      type: 'number',
      required: false,
      description: '版本号（冲突检测用）'
    },
    {
      name: '最后同步时间',
      fieldId: 'last_synced_at',
      type: 'datetime',
      required: false,
      description: '最后同步时间'
    },
    {
      name: '同步来源',
      fieldId: 'sync_source',
      type: 'select',
      required: false,
      options: ['系统', '飞书', '手动'],
      description: '同步来源'
    }
  ]
};

// 排期表模板
export const schedulesTableTemplate: TableTemplate = {
  tableName: '排期',
  description: '排期信息表，记录每次排期的结果',
  fields: [
    {
      name: '排期ID',
      fieldId: 'id',
      type: 'text',
      required: true,
      description: '排期唯一标识'
    },
    {
      name: '项目',
      fieldId: 'project',
      type: 'link',
      required: false,
      description: '关联项目表的记录'
    },
    {
      name: '排期名称',
      fieldId: 'name',
      type: 'text',
      required: true,
      description: '排期名称'
    },
    {
      name: '排期版本',
      fieldId: 'version',
      type: 'number',
      required: false,
      description: '排期版本号'
    },
    {
      name: '任务总数',
      fieldId: 'task_count',
      type: 'number',
      required: false,
      description: '任务总数'
    },
    {
      name: '总工时',
      fieldId: 'total_hours',
      type: 'number',
      required: false,
      description: '总工时'
    },
    {
      name: '资源利用率',
      fieldId: 'utilization',
      type: 'percent',
      required: false,
      description: '资源利用率'
    },
    {
      name: '关键路径数量',
      fieldId: 'critical_path_count',
      type: 'number',
      required: false,
      description: '关键路径任务数量'
    },
    {
      name: '排期开始时间',
      fieldId: 'start_time',
      type: 'datetime',
      required: false,
      description: '排期开始时间'
    },
    {
      name: '排期结束时间',
      fieldId: 'end_time',
      type: 'datetime',
      required: false,
      description: '排期结束时间'
    },
    {
      name: '生成时间',
      fieldId: 'generated_at',
      type: 'datetime',
      required: false,
      description: '排期生成时间'
    },
    {
      name: '创建时间',
      fieldId: 'created_at',
      type: 'datetime',
      required: false,
      description: '记录创建时间'
    },
    {
      name: '更新时间',
      fieldId: 'updated_at',
      type: 'datetime',
      required: false,
      description: '记录更新时间'
    }
  ]
};

// 导出所有表格模板
export const allTableTemplates: TableTemplate[] = [
  resourcesTableTemplate,
  projectsTableTemplate,
  tasksTableTemplate,
  schedulesTableTemplate
];

/**
 * 导出表格模板为 Markdown 格式
 */
export function exportTableTemplateToMarkdown(template: TableTemplate): string {
  let markdown = `# ${template.tableName}\n\n`;
  markdown += `${template.description}\n\n`;
  markdown += `## 字段列表\n\n`;
  markdown += `| 字段名称 | 字段ID | 字段类型 | 必填 | 选项 | 说明 |\n`;
  markdown += `|---------|-------|---------|------|------|------|\n`;

  template.fields.forEach(field => {
    const required = field.required ? '✅' : '❌';
    const options = field.options ? field.options.join(', ') : '-';
    markdown += `| ${field.name} | \`${field.fieldId}\` | ${field.type} | ${required} | ${options} | ${field.description || '-'} |\n`;
  });

  return markdown;
}

/**
 * 导出所有表格模板为 Markdown 格式
 */
export function exportAllTableTemplatesToMarkdown(): string {
  let markdown = `# 飞书多维表创建模板\n\n`;
  markdown += `本文档包含所有表格的字段配置，请在创建表格时参考。\n\n`;
  markdown += `---\n\n`;

  allTableTemplates.forEach((template, index) => {
    markdown += exportTableTemplateToMarkdown(template);
    if (index < allTableTemplates.length - 1) {
      markdown += `\n---\n\n`;
    }
  });

  return markdown;
}

/**
 * 下载表格模板文件
 */
export function downloadTableTemplateMarkdown(): void {
  const markdown = exportAllTableTemplatesToMarkdown();
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '飞书表格创建模板.md';
  a.click();
  URL.revokeObjectURL(url);
}
