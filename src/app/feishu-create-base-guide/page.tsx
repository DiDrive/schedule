'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Plus, ArrowRight, Copy, ExternalLink, FileSpreadsheet, Users, Calendar, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Field {
  name: string;
  type: string;
  description: string;
}

interface Table {
  name: string;
  icon: React.ReactNode;
  description: string;
  fields: Field[];
}

const tables: Table[] = [
  {
    name: '人员表',
    icon: <Users className="h-5 w-5" />,
    description: '存储团队成员信息和资源配置',
    fields: [
      { name: '姓名', type: '文本', description: '人员的姓名' },
      { name: 'ID', type: '文本', description: '人员的唯一标识符，自动生成' },
      { name: '类型', type: '单选', description: '人员类型：全职、兼职、外包' },
      { name: '工作效率', type: '数字', description: '工作效率系数，默认为 1.0' },
      { name: '技能', type: '多选', description: '人员技能标签' },
      { name: '部门', type: '单选', description: '所属部门' },
      { name: '邮箱', type: '邮箱', description: '联系邮箱' },
      { name: '状态', type: '单选', description: '状态：可用、忙碌、休假' },
    ]
  },
  {
    name: '项目表',
    icon: <Database className="h-5 w-5" />,
    description: '存储项目基本信息',
    fields: [
      { name: '项目名称', type: '文本', description: '项目的名称' },
      { name: 'ID', type: '文本', description: '项目的唯一标识符，自动生成' },
      { name: '状态', type: '单选', description: '状态：未开始、进行中、已完成、已暂停' },
      { name: '优先级', type: '单选', description: '优先级：高、中、低' },
      { name: '开始日期', type: '日期', description: '项目开始日期' },
      { name: '结束日期', type: '日期', description: '项目结束日期' },
      { name: '负责人', type: '人员', description: '项目负责人' },
      { name: '描述', type: '文本', description: '项目描述' },
    ]
  },
  {
    name: '任务表',
    icon: <FileSpreadsheet className="h-5 w-5" />,
    description: '存储任务信息和依赖关系',
    fields: [
      { name: '任务名称', type: '文本', description: '任务的名称' },
      { name: 'ID', type: '文本', description: '任务的唯一标识符，自动生成' },
      { name: '项目ID', type: '文本', description: '关联的项目ID' },
      { name: '状态', type: '单选', description: '状态：未开始、进行中、已完成、已暂停' },
      { name: '优先级', type: '单选', description: '优先级：高、中、低' },
      { name: '负责人', type: '人员', description: '任务负责人' },
      { name: '开始日期', type: '日期', description: '任务开始日期' },
      { name: '结束日期', type: '日期', description: '任务结束日期' },
      { name: '工时估算', type: '数字', description: '预计需要的人天' },
      { name: '前置任务ID', type: '多选', description: '依赖的前置任务ID列表' },
      { name: '进度', type: '数字', description: '完成进度百分比' },
      { name: '描述', type: '文本', description: '任务描述' },
      { name: '创建时间', type: '日期', description: '任务创建时间' },
      { name: '更新时间', type: '日期', description: '任务最后更新时间' },
      { name: '是否关键路径', type: '复选框', description: '是否在关键路径上' },
      { name: '是否超期', type: '复选框', description: '是否超期' },
      { name: '资源冲突', type: '复选框', description: '是否存在资源冲突' },
      { name: '紧急程度', type: '单选', description: '紧急程度：非常紧急、紧急、一般、不紧急' },
    ]
  },
  {
    name: '排期表',
    icon: <Calendar className="h-5 w-5" />,
    description: '存储排期结果和资源分配',
    fields: [
      { name: '项目ID', type: '文本', description: '关联的项目ID' },
      { name: '任务ID', type: '文本', description: '关联的任务ID' },
      { name: '人员ID', type: '文本', description: '关联的人员ID' },
      { name: '开始日期', type: '日期', description: '排期开始日期' },
      { name: '结束日期', type: '日期', description: '排期结束日期' },
      { name: '工时', type: '数字', description: '分配的工时（人天）' },
      { name: '利用率', type: '数字', description: '人员利用率百分比' },
      { name: '状态', type: '单选', description: '状态：已分配、未分配' },
      { name: '创建时间', type: '日期', description: '排期创建时间' },
      { name: '更新时间', type: '日期', description: '排期最后更新时间' },
      { name: '是否优化', type: '复选框', description: '是否经过AI优化' },
      { name: '优化建议', type: '文本', description: 'AI优化的建议' },
    ]
  }
];

export default function FeishuCreateBaseGuidePage() {
  const [activeTable, setActiveTable] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const copyFields = (index: number) => {
    const table = tables[index];
    const text = table.fields.map(field => `${field.name} (${field.type}) - ${field.description}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openFeishuCreate = () => {
    window.open('https://vbangessentials.feishu.cn/home', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            创建飞书多维表指南
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            创建一个新的多维表，避免权限问题
          </p>
        </div>

        {/* 为什么创建新多维表 */}
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-400">推荐方案</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-500">
            创建新的多维表是最简单可靠的方案，你的飞书应用会自动拥有新创建多维表的完整访问权限，无需任何额外配置。
          </AlertDescription>
        </Alert>

        {/* 创建步骤 */}
        <Card>
          <CardHeader>
            <CardTitle>创建步骤</CardTitle>
            <CardDescription>按照以下步骤创建新的多维表</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3">
              <li className="pl-2">
                <p className="font-medium mb-1">打开飞书工作台</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">点击飞书左侧导航栏的「+」按钮，或者直接访问工作台</p>
              </li>
              <li className="pl-2">
                <p className="font-medium mb-1">创建多维表格</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">点击「+」→「多维表格」，输入表格名称（例如：项目排期系统）</p>
              </li>
              <li className="pl-2">
                <p className="font-medium mb-1">创建 4 个表格</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">在多维表中依次创建以下 4 个表格：人员表、项目表、任务表、排期表</p>
              </li>
              <li className="pl-2">
                <p className="font-medium mb-1">为每个表格添加字段</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">参考下方的字段列表，为每个表格添加相应的字段</p>
              </li>
              <li className="pl-2">
                <p className="font-medium mb-1">复制多维表 URL</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">创建完成后，复制浏览器地址栏的 URL</p>
              </li>
              <li className="pl-2">
                <p className="font-medium mb-1">更新配置</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">在配置指南页面粘贴 URL，系统会自动提取 App Token 和 Table IDs</p>
              </li>
            </ol>

            <Button onClick={openFeishuCreate} className="w-full mt-4">
              <ExternalLink className="h-4 w-4 mr-2" />
              打开飞书创建多维表
            </Button>
          </CardContent>
        </Card>

        {/* 表格字段配置 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            表格字段配置
          </h2>

          {/* 表格选择器 */}
          <div className="flex gap-2 flex-wrap">
            {tables.map((table, index) => (
              <Button
                key={index}
                variant={activeTable === index ? "default" : "outline"}
                onClick={() => setActiveTable(index)}
              >
                {table.icon}
                <span className="ml-2">{table.name}</span>
              </Button>
            ))}
          </div>

          {/* 字段列表 */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {tables[activeTable].icon}
                    {tables[activeTable].name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {tables[activeTable].description}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyFields(activeTable)}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  {copied ? '已复制' : '复制字段列表'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 border-b pb-2">
                  <div className="col-span-3">字段名称</div>
                  <div className="col-span-3">字段类型</div>
                  <div className="col-span-6">字段说明</div>
                </div>
                {tables[activeTable].fields.map((field, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="col-span-3 font-medium">{field.name}</div>
                    <div className="col-span-3">
                      <Badge variant="secondary">{field.type}</Badge>
                    </div>
                    <div className="col-span-6 text-sm text-slate-600 dark:text-slate-400">
                      {field.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 类型说明 */}
        <Card>
          <CardHeader>
            <CardTitle>字段类型说明</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">文本</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">用于存储字符串，如姓名、ID</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">数字</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">用于存储数值，如工时、进度</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">日期</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">用于存储日期，如开始日期</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">单选</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">从预设选项中选择一个</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">多选</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">从预设选项中选择多个</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">人员</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">关联飞书用户</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">复选框</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">勾选或取消勾选</p>
            </div>
            <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
              <p className="font-medium text-sm">邮箱</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">用于存储邮箱地址</p>
            </div>
          </CardContent>
        </Card>

        {/* 完成后操作 */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              创建完成后的操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">1.</span>
              <span>复制多维表 URL（浏览器地址栏）</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">2.</span>
              <span>访问 App Token 配置指南页面</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">3.</span>
              <span>粘贴 URL 并提取 App Token 和 Table IDs</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">4.</span>
              <span>更新配置并测试</span>
            </div>

            <Button
              className="w-full mt-4"
              onClick={() => window.location.href = '/feishu-app-token-guide'}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              前往 App Token 配置指南
            </Button>
          </CardContent>
        </Card>

        {/* 快速链接 */}
        <Card>
          <CardHeader>
            <CardTitle>快速链接</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={openFeishuCreate}>
              <Plus className="h-4 w-4 mr-2" />
              创建多维表
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/feishu-app-token-guide'}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              App Token 配置指南
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
