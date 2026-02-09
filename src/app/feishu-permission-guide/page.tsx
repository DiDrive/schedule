'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, ExternalLink, AlertCircle, Shield, Users, Settings, Key, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SolutionStep {
  title: string;
  description: string;
  steps: string[];
}

const solutions: SolutionStep[] = [
  {
    title: "方案 1：创建新的飞书多维表（推荐）",
    description: "这是最简单可靠的解决方案，创建新多维表后应用自动拥有访问权限",
    steps: [
      "打开飞书，点击「+」→「多维表格」",
      "创建一个全新的多维表（命名为「项目排期系统」）",
      "在新多维表中创建 4 个表格：人员表、项目表、任务表、排期表",
      "按照系统要求配置每个表格的字段（参考详细指南）",
      "复制新多维表的 URL",
      "在配置指南页面粘贴 URL 并提取 App Token",
      "更新配置中的 App Token 和 Table IDs"
    ]
  },
  {
    title: "方案 2：在飞书开放平台授权多维表",
    description: "通过飞书开放平台的多维表格权限管理进行授权",
    steps: [
      "打开飞书开放平台（https://open.feishu.cn/app）",
      "找到并进入你的企业自建应用",
      "点击左侧菜单「权限管理」→「多维表格」",
      "点击「添加多维表格」或「授权」",
      "搜索并选择你要使用的多维表",
      "选择权限范围（通常选择「全部表格」）",
      "点击「确定」保存",
      "返回配置指南页面，重新测试"
    ]
  },
  {
    title: "方案 3：联系多维表所有者",
    description: "如果你不是多维表的所有者，需要联系所有者进行授权",
    steps: [
      "确认多维表的所有者是谁",
      "联系所有者，请求他们授权",
      "所有者在飞书开放平台中进入应用管理",
      "点击「权限管理」→「多维表格」",
      "添加你的多维表并授权",
      "等待权限生效（1-2分钟）",
      "返回配置指南页面，重新测试"
    ]
  }
];

export default function FeishuPermissionGuidePage() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const copySteps = (index: number) => {
    const solution = solutions[index];
    const text = `${solution.title}\n\n${solution.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedStep(index);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const openFeishuApp = () => {
    window.open('https://open.feishu.cn/app', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            飞书权限问题解决方案
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            解决「no permission to bitable app」错误
          </p>
        </div>

        {/* 错误信息 */}
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>错误码：99991663</AlertTitle>
          <AlertDescription>
            <strong>no permission to bitable app</strong>
            <br />
            你的飞书应用没有访问多维表的权限
          </AlertDescription>
        </Alert>

        {/* 问题说明 */}
        <Card>
          <CardHeader>
            <CardTitle>问题原因</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">权限隔离</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  飞书的每个多维表都有独立的权限控制，应用必须被明确授权才能访问
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">企业自建应用</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  你使用的是企业自建应用，这类应用默认只能访问自己创建的多维表
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">Token 和权限不匹配</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  App Token 正确，但应用没有访问该多维表的权限，所以 API 返回拒绝访问
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 解决方案 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            三种解决方案
          </h2>

          {solutions.map((solution, index) => (
            <Card key={index} className={index === 2 ? "border-2 border-green-500" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {index === 0 && <Badge>推荐</Badge>}
                      {index === 2 && <Badge variant="secondary">最简单</Badge>}
                      {solution.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {solution.description}
                    </CardDescription>
                  </div>
                  {index === 2 && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-decimal list-inside space-y-3">
                  {solution.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="pl-2 text-sm">
                      <span dangerouslySetInnerHTML={{ __html: step }}></span>
                    </li>
                  ))}
                </ol>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copySteps(index)}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    {copiedStep === index ? '已复制' : '复制步骤'}
                  </Button>
                  {index === 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openFeishuApp}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      打开飞书开放平台
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 快速操作 */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => window.location.href = '/feishu-create-base-guide'}
            >
              <Plus className="h-4 w-4 mr-2" />
              创建新多维表（推荐）
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={openFeishuApp}
            >
              <Settings className="h-4 w-4 mr-2" />
              打开飞书开放平台管理权限
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/feishu-app-token-guide'}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              返回 App Token 配置指南
            </Button>
          </CardContent>
        </Card>

        {/* 提示 */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>重要提示</AlertTitle>
          <AlertDescription>
            完成授权后，需要等待 1-2 分钟让权限生效，然后返回 App Token 配置指南页面重新测试。
            如果问题仍然存在，建议选择方案 3（创建新的多维表），这是最简单和最可靠的方式。
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
