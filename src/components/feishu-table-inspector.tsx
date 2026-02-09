'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { type FeishuConfig } from '@/lib/feishu-client';

interface FieldInfo {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
}

interface TableInfo {
  tableName: string;
  tableId: string;
  fields: FieldInfo[];
  sampleRecord: any;
  hasError: boolean;
  errorMessage?: string;
}

interface FeishuTableInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: FeishuConfig;
}

export default function FeishuTableInspector({ open, onOpenChange, config }: FeishuTableInspectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [tableInfo, setTableInfo] = useState<TableInfo[]>([]);
  const [copied, setCopied] = useState(false);

  const expectedFields = {
    resources: {
      '人员ID': 'id',
      '姓名': 'name',
      '工作类型': 'singleSelect',
      '效率': 'number',
      '飞书用户': 'person',
      '总工时': 'number',
      '创建时间': 'datetime',
      '更新时间': 'datetime',
    },
    projects: {
      '项目ID': 'id',
      '项目名称': 'name',
      '项目描述': 'text',
      '开始日期': 'date',
      '结束日期': 'date',
      '项目状态': 'singleSelect',
      '创建时间': 'datetime',
      '更新时间': 'datetime',
    },
    tasks: {
      '任务ID': 'id',
      '任务名称': 'name',
      '所属项目': 'link',
      '任务类型': 'singleSelect',
      '预估工时': 'number',
      '实际工时': 'number',
      '开始时间': 'datetime',
      '结束时间': 'datetime',
      '截止日期': 'datetime',
      '优先级': 'singleSelect',
      '负责人': 'person',
      '依赖关系': 'multiSelect',
      '任务状态': 'singleSelect',
      '是否超期': 'checkbox',
      '飞书版本': 'number',
      '系统版本': 'number',
      '最后同步时间': 'datetime',
      '同步来源': 'singleSelect',
      '创建时间': 'datetime',
      '更新时间': 'datetime',
    },
    schedules: {
      '任务ID': 'id',
      '项目': 'text',
      '任务名称': 'text',
      '版本': 'number',
      '任务数': 'number',
      '总工时': 'number',
      '利用率': 'number',
      '关键路径数': 'number',
      '开始时间': 'datetime',
      '结束时间': 'datetime',
      '创建时间': 'datetime',
      '更新时间': 'datetime',
    },
  };

  const inspectTables = async () => {
    setIsLoading(true);
    setTableInfo([]);

    try {
      const response = await fetch('/api/feishu/inspect-tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          expectedFields: {
            resources: expectedFields.resources,
            projects: expectedFields.projects,
            tasks: expectedFields.tasks,
            schedules: expectedFields.schedules,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTableInfo(data.tableInfo);
      } else {
        console.error('表格检测失败:', data.message);
        alert(`表格检测失败: ${data.message}`);
      }
    } catch (error) {
      console.error('表格检测失败:', error);
      alert('表格检测失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const copyFieldIds = () => {
    const fieldIdsText = tableInfo.map(table => {
      const fields = table.fields.map(f => f.fieldId).join(', ');
      return `${table.tableName}: ${fields}`;
    }).join('\n');

    navigator.clipboard.writeText(fieldIdsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fixMissingFields = async () => {
    setIsFixing(true);

    try {
      // 收集需要创建的字段
      const fieldsToCreate: Array<{
        tableName: string;
        tableId: string;
        fields: Array<{ fieldId: string; fieldName: string; fieldType: string; options?: string[] }>;
      }> = [];

      const tableMappings: Record<string, any> = {
        '人员表': expectedFields.resources,
        '项目表': expectedFields.projects,
        '任务表': expectedFields.tasks,
        '排期表': expectedFields.schedules,
      };

      // 单选字段选项
      const fieldOptions: Record<string, string[]> = {
        '工作类型': ['平面设计', '后期制作', '物料'],
        '项目状态': ['未开始', '进行中', '已完成', '已暂停'],
        '任务类型': ['平面设计', '后期制作', '物料'],
        '优先级': ['高', '中', '低'],
        '任务状态': ['未开始', '进行中', '已完成', '已暂停', '已超期'],
        '同步来源': ['系统', '飞书', '手动'],
      };

      for (const table of tableInfo) {
        if (table.hasError && table.errorMessage?.includes('缺少字段')) {
          const missingFields = table.errorMessage.match(/缺少字段: (.+)/)?.[1].split(', ') || [];
          const fieldDefinitions = tableMappings[table.tableName];

          if (fieldDefinitions && missingFields.length > 0) {
            const fields = missingFields.map(fieldName => {
              const fieldType = fieldDefinitions[fieldName] || 'text';
              const options = fieldOptions[fieldName] || undefined;

              return {
                fieldId: fieldName,
                fieldName: fieldName,
                fieldType,
                options,
              };
            });

            fieldsToCreate.push({
              tableName: table.tableName,
              tableId: table.tableId,
              fields,
            });
          }
        }
      }

      if (fieldsToCreate.length === 0) {
        alert('没有需要创建的字段');
        setIsFixing(false);
        return;
      }

      const response = await fetch('/api/feishu/create-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config,
          fieldsToCreate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        // 重新检测表格
        await inspectTables();
      } else {
        const failedItems = data.results.filter((r: any) => !r.success);
        const errorMessages = failedItems.map((r: any) => `${r.tableName} - ${r.fieldName}: ${r.message}`).join('\n');
        alert(`部分字段创建失败：\n${errorMessages}`);
      }
    } catch (error) {
      console.error('创建字段失败:', error);
      alert('创建字段失败，请检查网络连接');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>飞书表格结构检测</DialogTitle>
          <DialogDescription>
            检测飞书多维表的字段结构，确保与系统配置一致
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={inspectTables} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                开始检测
              </>
            )}
          </Button>

          {tableInfo.length > 0 && tableInfo.some(t => t.hasError) && (
            <Button
              onClick={fixMissingFields}
              disabled={isFixing || isLoading}
              variant="destructive"
              className="w-full"
            >
              {isFixing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  修复中...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  自动修复缺失字段
                </>
              )}
            </Button>
          )}

          {tableInfo.length > 0 && (
            <>
              <Button onClick={copyFieldIds} variant="outline" className="w-full">
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    复制字段ID
                  </>
                )}
              </Button>

              <div className="space-y-4">
                {tableInfo.map((table, index) => (
                  <Card key={index} className={table.hasError ? 'border-red-500' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{table.tableName}</CardTitle>
                        {table.hasError ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            错误
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            正常
                          </Badge>
                        )}
                      </div>
                      <CardDescription>Table ID: {table.tableId || '未配置'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {table.hasError ? (
                        <div className="space-y-3">
                          <div className="text-red-600 dark:text-red-400 font-medium">
                            {table.errorMessage}
                          </div>
                          {table.errorMessage?.includes('缺少字段') && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">缺失字段详情：</h4>
                              {table.errorMessage.match(/缺少字段: (.+)/)?.[1].split(', ').map((missingFieldName) => {
                                const tableName = table.tableName;
                                let template: any = null;
                                if (tableName === '人员表') {
                                  template = expectedFields.resources;
                                } else if (tableName === '项目表') {
                                  template = expectedFields.projects;
                                } else if (tableName === '任务表') {
                                  template = expectedFields.tasks;
                                } else if (tableName === '排期表') {
                                  template = expectedFields.schedules;
                                }
                                const fieldType = template?.[missingFieldName] || 'text';
                                return (
                                  <div key={missingFieldName} className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-sm">
                                    <div className="font-mono font-medium">{missingFieldName}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">类型: {fieldType}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {table.tableId === '' && (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              请先在飞书配置中设置 Table ID
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <h4 className="font-medium mb-2">检测到的字段 ({table.fields.length} 个)</h4>
                            <div className="flex flex-wrap gap-2">
                              {table.fields.map((field, fieldIndex) => (
                                <Badge key={fieldIndex} variant={field.isRequired ? 'default' : 'outline'}>
                                  {field.fieldName} ({field.fieldType})
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {table.sampleRecord && (
                            <div>
                              <h4 className="font-medium mb-2">示例数据</h4>
                              <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md overflow-x-auto text-xs">
                                {JSON.stringify(table.sampleRecord, null, 2)}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
