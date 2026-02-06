'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Copy, Download, Upload, Info, FileText, AlertTriangle } from 'lucide-react';
import { downloadTableTemplateMarkdown } from '@/lib/feishu-table-templates';
import ExcelTemplateGenerator from './excel-template-generator';

interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableIds: {
    resources: string;
    projects: string;
    tasks: string;
    schedules: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface FeishuConfigHelperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeishuConfigHelper({ open, onOpenChange }: FeishuConfigHelperProps) {
  const [config, setConfig] = useState<FeishuConfig>({
    appId: '',
    appSecret: '',
    appToken: '',
    tableIds: {
      resources: '',
      projects: '',
      tasks: '',
      schedules: '',
    },
  });

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputUrl, setInputUrl] = useState('');

  // 从 localStorage 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('feishu-config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
  }, [open]);

  // 验证配置
  const validateConfig = (): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证 App ID
    if (!config.appId) {
      errors.push('App ID 未填写');
    } else if (!config.appId.startsWith('cli_')) {
      errors.push('App ID 格式不正确，应以 "cli_" 开头');
    }

    // 验证 App Secret
    if (!config.appSecret) {
      errors.push('App Secret 未填写');
    } else if (config.appSecret.length < 10) {
      errors.push('App Secret 格式不正确，长度应不少于10位');
    }

    // 验证 App Token
    if (!config.appToken) {
      errors.push('App Token 未填写');
    } else if (config.appToken.length < 10) {
      errors.push('App Token 格式不正确，长度应不少于10位');
    } else if (!/^[a-zA-Z0-9]+$/.test(config.appToken)) {
      errors.push('App Token 格式不正确，只能包含字母和数字');
    }

    // 验证 Table IDs
    const tableNames = {
      resources: '人员表',
      projects: '项目表',
      tasks: '任务表',
      schedules: '排期表',
    };

    Object.entries(tableNames).forEach(([key, name]) => {
      const tableId = config.tableIds[key as keyof typeof tableNames];
      if (!tableId) {
        warnings.push(`${name} Table ID 未填写`);
      } else if (!tableId.startsWith('tbl')) {
        errors.push(`${name} Table ID 格式不正确，应以 "tbl" 开头`);
      }
    });

    return {
      isValid: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
    };
  };

  const handleValidate = () => {
    const result = validateConfig();
    setValidationResult(result);
  };

  // 导出配置
  const handleExportConfig = () => {
    const configStr = JSON.stringify(config, null, 2);
    const blob = new Blob([configStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feishu-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入配置
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        setConfig(importedConfig);
        localStorage.setItem('feishu-config', JSON.stringify(importedConfig));
        alert('配置导入成功！');
      } catch (error) {
        alert('配置导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  // 复制 App Token 到剪贴板
  const copyAppToken = () => {
    navigator.clipboard.writeText(config.appToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 从 URL 解析 App Token
  const parseAppTokenFromUrl = () => {
    const url = prompt('请粘贴您的飞书多维表 URL：\n\n例如：https://xxx.feishu.cn/base/bascnxxxxxxxxxxxx/appxxxxxxx');
    if (!url) return;

    const match = url.match(/\/base\/(bascn[a-zA-Z0-9]+)/);
    if (match) {
      setConfig({ ...config, appToken: match[1] });
      alert(`App Token 已提取：${match[1]}`);
    } else {
      alert('无法从 URL 中提取 App Token，请检查 URL 格式是否正确');
    }
  };

  // 快速导入：从 URL 提取 App Token 和 Table ID
  const handleQuickImport = () => {
    const url = inputUrl.trim();
    if (!url) {
      alert('请先粘贴飞书多维表 URL');
      return;
    }

    // 检查是否是有效的飞书多维表 URL（支持旧版和新版格式）
    // 旧版：/base/FovUbfThaa62nesBf0ZcPeO8nnb
    // 新版：/base/bascn5e1j2k3l4m5n6o7p8q
    const baseMatch = url.match(/\/base\/([a-zA-Z0-9]+)/);
    if (!baseMatch) {
      alert('URL 格式不正确，请确保是飞书多维表 URL（应包含 /base/）');
      return;
    }

    const appToken = baseMatch[1];

    // 提取 Table ID（如果有）
    const tableMatch = url.match(/table=(tbl[a-zA-Z0-9]+)/);
    const tableId = tableMatch ? tableMatch[1] : '';

    // 更新配置
    const updatedConfig = {
      ...config,
      appToken,
      tableIds: {
        ...config.tableIds,
        resources: tableId,
        projects: '',
        tasks: '',
        schedules: '',
      },
    };

    setConfig(updatedConfig);
    localStorage.setItem('feishu-config', JSON.stringify(updatedConfig));

    const message = tableId
      ? `成功提取信息！\n\nApp Token: ${appToken}\nTable ID: ${tableId}\n\n注意：这是当前打开的表格 ID，请根据需要在下方填写其他表格的 ID`
      : `成功提取 App Token！\n\nApp Token: ${appToken}\n\n未检测到 Table ID，请手动在下方填写`;

    alert(message);
  };

  const handleSave = () => {
    localStorage.setItem('feishu-config', JSON.stringify(config));
    alert('配置已保存！');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            飞书配置助手
          </DialogTitle>
          <DialogDescription>
            帮助您快速获取和验证飞书配置信息
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* 重要提示 */}
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                重要提示
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-amber-700 dark:text-amber-400">
                <strong>您的 URL 看起来是飞书知识库链接，而不是多维表格！</strong>
              </p>
              <p className="text-amber-600 dark:text-amber-500">
                正确的多维表格 URL 应该包含 <code className="px-1 py-0.5 bg-amber-200 dark:bg-amber-800 rounded">/base/</code> 而不是 <code className="px-1 py-0.5 bg-amber-200 dark:bg-amber-800 rounded">/wiki/</code>
              </p>
              <p className="text-amber-600 dark:text-amber-500">
                请按以下步骤创建多维表格：
              </p>
              <ol className="list-decimal list-inside space-y-1 text-amber-600 dark:text-amber-500 ml-2">
                <li>在飞书中点击左侧"云文档"</li>
                <li>点击"新建" → "多维表格"（注意：不是"知识库"）</li>
                <li>命名为"项目排期系统"</li>
                <li>复制新创建的多维表格 URL</li>
              </ol>
            </CardContent>
          </Card>

          {/* 快速导入 */}
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="h-5 w-5" />
                快速导入
              </CardTitle>
              <CardDescription>
                粘贴您的飞书多维表 URL，自动提取 App Token 和 Table ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="粘贴飞书多维表 URL，例如：https://xxx.feishu.cn/base/bascnxxxx/appxxx?table=tblxxxx"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                />
                <Button
                  onClick={handleQuickImport}
                  className="w-full"
                  disabled={!inputUrl}
                >
                  自动提取 App Token 和 Table ID
                </Button>
              </div>

              {config.appToken && config.tableIds.resources && (
                <div className="space-y-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    已提取的信息
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">App Token:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{config.appToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Table ID:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{config.tableIds.resources}</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    注意：这是当前打开的表格 ID，请根据需要在下方填写其他表格的 ID
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* App Token 获取帮助 */}
          <Card>
            <CardHeader>
              <CardTitle>1. 获取 App Token</CardTitle>
              <CardDescription>
                App Token 是多维表的唯一标识，用于 API 调用
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                <p className="text-sm font-medium">方法一：从 URL 中自动提取</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  打开您的飞书多维表，复制地址栏的 URL，然后点击下方按钮自动提取
                </p>
                <Button
                  variant="outline"
                  onClick={parseAppTokenFromUrl}
                  className="w-full"
                >
                  从 URL 提取 App Token
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                <p className="text-sm font-medium">方法二：手动输入</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  App Token 位于多维表 URL 的 <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">/base/</code> 和 <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">/app</code> 之间，通常由字母和数字组成
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="bascnxxxxxxxxxxxx"
                    value={config.appToken}
                    onChange={(e) => setConfig({ ...config, appToken: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyAppToken}
                    title="复制"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  示例
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono break-all">
                  https://xxx.feishu.cn/base/<span className="bg-blue-200 dark:bg-blue-800 px-1 rounded">FovUbfThaa62nesBf0ZcPeO8nnb</span>/appxxxxxxxx?table=tbl2d63n3DvpNwdb
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  App Token = FovUbfThaa62nesBf0ZcPeO8nnb
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Table ID = tbl2d63n3DvpNwdb
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Table ID 获取帮助 */}
          <Card>
            <CardHeader>
              <CardTitle>2. 获取 Table ID</CardTitle>
              <CardDescription>
                每个表格都有唯一的 Table ID，用于区分不同的数据表
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                <p className="text-sm font-medium">获取方法</p>
                <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
                  <li>点击表格名称（如"人员"表）</li>
                  <li>查看浏览器地址栏 URL</li>
                  <li>Table ID 位于 URL 的最后部分，通常以 <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">tbl</code> 开头</li>
                </ol>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono break-all mt-2">
                  https://xxx.feishu.cn/base/bascnxxx/appxxx?table=<span className="bg-blue-200 dark:bg-blue-800 px-1 rounded">tblxxxxxxxx</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="table-resources">人员表 Table ID</Label>
                  <Input
                    id="table-resources"
                    placeholder="tblxxxxxxxx"
                    value={config.tableIds.resources}
                    onChange={(e) => setConfig({
                      ...config,
                      tableIds: { ...config.tableIds, resources: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="table-projects">项目表 Table ID</Label>
                  <Input
                    id="table-projects"
                    placeholder="tblxxxxxxxx"
                    value={config.tableIds.projects}
                    onChange={(e) => setConfig({
                      ...config,
                      tableIds: { ...config.tableIds, projects: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="table-tasks">任务表 Table ID</Label>
                  <Input
                    id="table-tasks"
                    placeholder="tblxxxxxxxx"
                    value={config.tableIds.tasks}
                    onChange={(e) => setConfig({
                      ...config,
                      tableIds: { ...config.tableIds, tasks: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="table-schedules">排期表 Table ID</Label>
                  <Input
                    id="table-schedules"
                    placeholder="tblxxxxxxxx"
                    value={config.tableIds.schedules}
                    onChange={(e) => setConfig({
                      ...config,
                      tableIds: { ...config.tableIds, schedules: e.target.value }
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 配置验证 */}
          <Card>
            <CardHeader>
              <CardTitle>3. 验证配置</CardTitle>
              <CardDescription>
                检查配置是否正确，避免同步失败
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                onClick={handleValidate}
                className="w-full"
              >
                验证配置
              </Button>

              {validationResult && (
                <div className="space-y-3">
                  {validationResult.isValid ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">配置验证通过！</span>
                    </div>
                  ) : (
                    <>
                      {validationResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-600 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            错误（必须修复）
                          </p>
                          <div className="space-y-1">
                            {validationResult.errors.map((error, index) => (
                              <div key={index} className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm text-red-600">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {validationResult.warnings.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-amber-600 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            警告（建议修复）
                          </p>
                          <div className="space-y-1">
                            {validationResult.warnings.map((warning, index) => (
                              <div key={index} className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-600">
                                {warning}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 配置导入导出 */}
          <Card>
            <CardHeader>
              <CardTitle>4. 配置导入导出</CardTitle>
              <CardDescription>
                保存或恢复您的配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportConfig}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出配置
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('config-file-input')?.click()}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  导入配置
                </Button>
                <input
                  id="config-file-input"
                  type="file"
                  accept=".json"
                  onChange={handleImportConfig}
                  className="hidden"
                />
              </div>

              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={downloadTableTemplateMarkdown}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  下载 Markdown 模板
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  下载详细的表格字段配置文档（Markdown 格式）
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Excel 模板生成器 */}
          <ExcelTemplateGenerator />
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} className="flex-1">
            保存配置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
