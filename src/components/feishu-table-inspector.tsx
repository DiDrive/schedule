'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { listFeishuRecords, initFeishuClient, type FeishuConfig } from '@/lib/feishu-client';

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
  const [tableInfo, setTableInfo] = useState<TableInfo[]>([]);
  const [copied, setCopied] = useState(false);

  const expectedFields = {
    resources: {
      id: 'id',
      name: 'name',
      type: 'type',
      efficiency: 'efficiency',
      feishu_user: 'feishu_user',
      total_hours: 'total_hours',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
    projects: {
      id: 'id',
      name: 'name',
      description: 'description',
      start_date: 'start_date',
      end_date: 'end_date',
      status: 'status',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
    tasks: {
      id: 'id',
      name: 'name',
      project: 'project',
      type: 'type',
      estimated_hours: 'estimated_hours',
      actual_hours: 'actual_hours',
      start_time: 'start_time',
      end_time: 'end_time',
      deadline: 'deadline',
      priority: 'priority',
      assignee: 'assignee',
      dependencies: 'dependencies',
      status: 'status',
      is_overdue: 'is_overdue',
      feishu_version: 'feishu_version',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
    schedules: {
      id: 'id',
      project: 'project',
      name: 'name',
      version: 'version',
      task_count: 'task_count',
      total_hours: 'total_hours',
      utilization: 'utilization',
      critical_path_count: 'critical_path_count',
      start_time: 'start_time',
      end_time: 'end_time',
      created_at: 'created_at',
      updated_at: 'updated_at',
    },
  };

  const inspectTables = async () => {
    setIsLoading(true);
    setTableInfo([]);

    // 先初始化飞书客户端
    try {
      initFeishuClient(config);
    } catch (error) {
      console.error('初始化飞书客户端失败:', error);
      setIsLoading(false);
      return;
    }

    const tablesToCheck = [
      { name: '人员表', id: config.tableIds.resources, expected: expectedFields.resources },
      { name: '项目表', id: config.tableIds.projects, expected: expectedFields.projects },
      { name: '任务表', id: config.tableIds.tasks, expected: expectedFields.tasks },
      { name: '排期表', id: config.tableIds.schedules, expected: expectedFields.schedules },
    ];

    const results: TableInfo[] = [];

    for (const table of tablesToCheck) {
      if (!table.id) {
        results.push({
          tableName: table.name,
          tableId: '',
          fields: [],
          sampleRecord: null,
          hasError: true,
          errorMessage: 'Table ID 未配置',
        });
        continue;
      }

      try {
        const records = await listFeishuRecords(config.appToken, table.id, { pageSize: 1 });

        // 获取字段信息
        const sampleRecord = records.items[0] || null;
        const fields: FieldInfo[] = [];

        if (sampleRecord && sampleRecord.fields) {
          Object.keys(sampleRecord.fields).forEach(fieldId => {
            fields.push({
              fieldId,
              fieldName: fieldId, // 飞书 API 可能不返回字段名称
              fieldType: typeof sampleRecord.fields[fieldId],
              isRequired: Object.values(table.expected).includes(fieldId),
            });
          });
        }

        results.push({
          tableName: table.name,
          tableId: table.id,
          fields,
          sampleRecord,
          hasError: false,
        });
      } catch (error) {
        results.push({
          tableName: table.name,
          tableId: table.id,
          fields: [],
          sampleRecord: null,
          hasError: true,
          errorMessage: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    setTableInfo(results);
    setIsLoading(false);
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
                        <div className="text-red-600 dark:text-red-400">
                          {table.errorMessage}
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <h4 className="font-medium mb-2">检测到的字段 ({table.fields.length} 个)</h4>
                            <div className="flex flex-wrap gap-2">
                              {table.fields.map((field, fieldIndex) => (
                                <Badge key={fieldIndex} variant={field.isRequired ? 'default' : 'outline'}>
                                  {field.fieldId} ({field.fieldType})
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
