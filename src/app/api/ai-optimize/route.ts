import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { Task, Resource } from '@/types/schedule';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { tasks, resources, currentResult } = await request.json();

    // 准备系统提示词
    const systemPrompt = `你是一位专业的项目管理和排期优化专家。你的任务是根据当前的任务和资源情况，提供最高效率的排期优化建议。

## 你的职责：
1. 分析当前排期的瓶颈和优化空间
2. 提供具体的、可执行的优化建议
3. 识别潜在的资源冲突和风险
4. 建议最优的任务执行顺序和资源分配

## 输出格式要求：
请使用以下格式输出你的建议（使用Markdown）：

### 📊 当前情况分析
- 总工时：XX小时
- 总工期：XX天
- 资源利用率：XX%
- 关键任务：[任务列表]

### 🔧 优化建议
**1. [建议标题]**
- 原因：[为什么需要这个优化]
- 具体措施：[详细的操作步骤]
- 预期效果：[优化后的预期效果]

**2. [建议标题]**
- ...

### ⚠️ 风险提示
[列出可能的风险和应对措施]

### 💡 专家提示
[额外的专业建议]`;

    // 准备用户输入
    const userInput = `## 当前任务列表
${tasks.map((task: Task, index: number) => {
  const resource = resources.find((r: Resource) => r.id === task.assignedResources[0]);
  return `${index + 1}. **${task.name}**
   - 类型：${task.taskType || '未指定'}
   - 工时：${task.estimatedHours}小时
   - 优先级：${task.priority}
   - 负责人：${resource ? resource.name : '未分配'}
   - 开始时间：${task.startDate ? new Date(task.startDate).toLocaleString('zh-CN') : '未安排'}
   - 结束时间：${task.endDate ? new Date(task.endDate).toLocaleString('zh-CN') : '未安排'}
   - 依赖：${task.dependencies?.length ? task.dependencies.map(d => tasks.find((t: Task) => t.id === d)?.name).join(', ') : '无'}
   - 是否关键：${task.isCritical ? '是' : '否'}`;
}).join('\n')}

## 资源池
${resources.filter((r: Resource) => r.type === 'human').map((res: Resource, index: number) => {
  const assignedTasks = tasks.filter((t: Task) => t.assignedResources.includes(res.id));
  const totalHours = assignedTasks.reduce((sum: number, t: Task) => sum + t.estimatedHours, 0);
  return `${index + 1}. **${res.name}**
   - 类型：${res.workType || '未指定'}
   - 等级：${res.level || 'junior'}
   - 效率：${res.efficiency || 1.0}
   - 可用性：${(res.availability || 1.0) * 100}%
   - 已分配工时：${totalHours}小时
   - 已分配任务数：${assignedTasks.length}个`;
}).join('\n')}

${currentResult ? `
## 当前排期结果
- 总工期：${currentResult.totalDuration}天
- 总工时：${currentResult.totalHours}小时
- 关键路径任务数：${currentResult.criticalPath.length}个
- 资源冲突数：${currentResult.resourceConflicts.length}个
` : ''}

请基于以上信息，提供详细的排期优化建议。`;

    // 调用LLM
    const config = new Config();
    const client = new LLMClient(config);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userInput }
    ];

    // 使用流式输出
    const stream = client.stream(messages, {
      model: 'doubao-seed-1-6-thinking-250715',
      thinking: 'enabled',
      temperature: 0.7
    });

    // 创建TransformStream用于处理流式响应
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI优化API错误:', error);
    return NextResponse.json(
      { error: '生成优化建议失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
