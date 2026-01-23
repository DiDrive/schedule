import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScheduleAIRequest {
  tasks: Task[];
  resources: Resource[];
  scheduleResult: ScheduleResult;
  constraints?: {
    maxConcurrentTasks?: number;
    budgetLimit?: number;
    riskTolerance?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { tasks, resources, scheduleResult, constraints }: ScheduleAIRequest = await req.json();

    // 准备上下文信息
    const context = `
你是一位专业的项目管理专家和排期优化顾问。请基于以下项目信息提供智能排期建议：

## 项目概况
- 任务总数: ${tasks.length}
- 资源总数: ${resources.length}
- 项目总工期: ${scheduleResult.totalDuration} 天
- 预估总成本: ¥${scheduleResult.totalCost?.toLocaleString() || 'N/A'}
- 关键路径任务数: ${scheduleResult.criticalPath.length}
- 资源冲突数: ${scheduleResult.resourceConflicts.length}

## 任务列表
${tasks.map(task => `
任务: ${task.name}
- ID: ${task.id}
- 工时: ${task.estimatedHours} 小时
- 优先级: ${task.priority}
- 状态: ${task.status}
- 负责人: ${task.assignedResources.join(', ')}
${task.tags ? `- 标签: ${task.tags.join(', ')}` : ''}
${task.riskFactor ? `- 风险系数: ${task.riskFactor}` : ''}
${task.dependencies ? `- 依赖任务: ${task.dependencies.join(', ')}` : ''}
`).join('\n')}

## 资源列表
${resources.map(resource => `
资源: ${resource.name}
- 类型: ${resource.type}
- 可用性: ${(resource.availability * 100).toFixed(0)}%
${resource.skills ? `- 技能: ${resource.skills.join(', ')}` : ''}
${resource.hourlyRate ? `- 时薪: ¥${resource.hourlyRate}` : ''}
`).join('\n')}

${constraints ? `## 约束条件
${constraints.maxConcurrentTasks ? `- 最大并发任务: ${constraints.maxConcurrentTasks}` : ''}
${constraints.budgetLimit ? `- 预算限制: ¥${constraints.budgetLimit.toLocaleString()}` : ''}
${constraints.riskTolerance ? `- 风险容忍度: ${(constraints.riskTolerance * 100).toFixed(0)}%` : ''}
` : ''}

${scheduleResult.resourceConflicts.length > 0 ? `## 资源冲突
${scheduleResult.resourceConflicts.map(conflict => `
- ${conflict.resourceName}: ${conflict.tasks.length} 个任务冲突
  严重程度: ${conflict.severity}
  建议: ${conflict.suggestedResolution}
`).join('\n')}
` : ''}

${scheduleResult.recommendations.length > 0 ? `## 算法建议
${scheduleResult.recommendations.map(rec => `- ${rec}`).join('\n')}
` : ''}

请基于以上信息，从以下几个维度提供详细的智能排期建议：

1. **排期优化策略**: 如何优化任务顺序和资源分配以缩短工期或降低成本
2. **关键路径分析**: 关键路径上的关键节点，以及如何管理这些节点
3. **资源优化建议**: 如何提高资源利用率，解决资源冲突
4. **风险缓解措施**: 识别潜在风险并提供缓解策略
5. **权衡分析**: 在工期、成本、质量之间如何做出最优权衡

请用清晰、专业的语言提供建议，每条建议都应该具体、可操作。
`;

    // 创建流式响应
    const config = new Config();
    const client = new LLMClient(config);

    const messages = [
      {
        role: 'system' as const,
        content: '你是一位资深的项目管理专家和排期优化顾问，擅长通过数据分析和智能算法提供项目排期建议。你的回答应该专业、具体、可操作。'
      },
      {
        role: 'user' as const,
        content: context
      }
    ];

    // 使用流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const aiStream = client.stream(messages, {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.7
          });

          for await (const chunk of aiStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              const data = encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`);
              controller.enqueue(data);
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('AI Stream Error:', error);
          const errorMsg = encoder.encode(`data: ${JSON.stringify({ error: '生成建议时出错' })}\n\n`);
          controller.enqueue(errorMsg);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Schedule AI Error:', error);
    return NextResponse.json(
      { error: '生成智能建议失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
