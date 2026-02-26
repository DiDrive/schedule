import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';
import {
  parsePersonField,
  parseOptionField,
  parseDateField,
  parseNumberField,
  parseStringField,
  parseArrayField,
  debugField,
} from '@/lib/feishu-field-parser';

// 日志函数
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    const fs = require('fs');
    fs.appendFileSync('/app/work/logs/bypass/feishu-sync.log', logMessage);
  } catch (error) {
    // 忽略日志写入错误
  }
};

/**
 * 从飞书多维表加载排期系统数据
 *
 * 请求参数（通过 URL 传递）:
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表格 App Token
 * - resources_table_id: 人员表 Table ID
 * - projects_table_id: 项目表 Table ID
 * - tasks_table_id: 任务表 Table ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const resourcesTableId = searchParams.get('resources_table_id');
    const projectsTableId = searchParams.get('projects_table_id');
    const tasksTableId = searchParams.get('tasks_table_id');

    if (!appId || !appSecret) {
      log('[飞书加载] ❌ 缺少 app_id 或 app_secret');
      return NextResponse.json(
        { error: '缺少 app_id 或 app_secret' },
        { status: 400 }
      );
    }

    if (!appToken) {
      log('[飞书加载] ❌ 缺少 app_token');
      return NextResponse.json(
        { error: '缺少 app_token' },
        { status: 400 }
      );
    }

    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log(`[飞书加载] 开始从多维表加载数据: app_token=${appToken.substring(0, 10)}...`);

    const result: any = {
      resources: [],
      projects: [],
      tasks: [],
    };

    // 加载人员数据
    if (resourcesTableId) {
      log(`[飞书加载] 加载人员数据: table_id=${resourcesTableId}`);
      const resourcesResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${resourcesTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const resourcesData = await resourcesResponse.json();
      if (resourcesData.code === 0 && resourcesData.data) {
        log(`[飞书加载] 🔍 人员原始数据示例: ${JSON.stringify(resourcesData.data.items[0]?.fields).substring(0, 200)}...`);

        result.resources = resourcesData.data.items.map((item: any) => {
          const fields = item.fields;

          // 解析人员姓名字段（可能是文本字段，也可能是人员字段）
          let name = '';
          if (fields.name) name = parseStringField(fields.name);
          else if (fields['姓名']) name = parseStringField(fields['姓名']);
          else if (fields['人员姓名']) name = parseStringField(fields['人员姓名']);
          else if (fields['人员']) {
            // 如果"人员"字段是人员类型，提取第一个人的名字
            const personName = parseStringField(fields['人员']);
            if (personName) name = personName;
          }

          // 解析技能字段（可能是文本、选项或多选）
          let skills: string[] = [];
          if (fields.skills) skills = parseArrayField(parseStringField(fields.skills), []);
          else if (fields['技能']) skills = parseArrayField(parseStringField(fields['技能']), []);

          // 解析工作类型（下拉选项）
          const workType = parseOptionField(fields.workType || fields['工作类型'], true) || '';

          // 解析资源等级（下拉选项）
          const level = parseOptionField(fields.level || fields['等级'], true) || '';

          // 解析效率系数
          const efficiency = parseNumberField(fields.efficiency || fields['效率'], 1.0);

          // 解析可用性（0-1）
          const availability = parseNumberField(fields.availability || fields['可用性'], 1.0) / 100;

          // 解析时薪
          const hourlyRate = parseNumberField(fields.hourlyRate || fields['时薪'], 0);

          // 解析邮箱
          const email = parseStringField(fields.email || fields['邮箱'], '');

          // 如果没有指定名称，使用 record_id
          if (!name) {
            name = `资源_${item.record_id.substring(0, 8)}`;
          }

          return {
            id: item.record_id,
            name: name,
            type: 'human',
            workType: workType,
            level: level,
            efficiency: efficiency,
            skills: skills,
            availability: availability,
            hourlyRate: hourlyRate,
            email: email,
            color: '#64748b', // 默认颜色
          };
        });
        log(`[飞书加载] ✅ 加载了 ${result.resources.length} 个人员`);
      } else {
        log(`[飞书加载] ❌ 加载人员数据失败: ${JSON.stringify(resourcesData)}`);
      }
    }

    // 加载任务数据（先加载任务，因为项目需要从任务中提取资源池）
    if (tasksTableId) {
      log(`[飞书加载] 加载任务数据: table_id=${tasksTableId}`);
      const tasksResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tasksTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 500 }),
        }
      );

      const tasksData = await tasksResponse.json();
      if (tasksData.code === 0 && tasksData.data) {
        log(`[飞书加载] 🔍 任务原始数据示例: ${JSON.stringify(tasksData.data.items[0]?.fields).substring(0, 200)}...`);

        result.tasks = tasksData.data.items.map((item: any) => {
          const fields = item.fields;

          // 解析任务名称
          const name = parseStringField(fields.name || fields['任务名称'], `任务_${item.record_id.substring(0, 8)}`);

          // 解析项目ID
          const projectId = parseStringField(fields.projectId || fields['项目ID'] || fields['项目']);

          // 解析负责人（人员字段，提取 ID）
          const assignedResourceId = parsePersonField(fields.assignedResourceId || fields['负责人ID'] || fields['负责人']);

          // 解析任务类型（下拉选项）
          const taskType = parseOptionField(fields.taskType || fields['任务类型'], true) || '';

          // 解析预估工时
          const estimatedHours = parseNumberField(fields.estimatedHours || fields['预估工时'], 8);

          // 解析优先级（下拉选项）
          const priorityOption = parseOptionField(fields.priority || fields['优先级'], true);
          let priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal';
          if (typeof priorityOption === 'string') {
            const lower = priorityOption.toLowerCase();
            if (lower === 'urgent' || lower === '紧急') priority = 'urgent';
            else if (lower === 'high' || lower === '高') priority = 'high';
            else if (lower === 'low' || lower === '低') priority = 'low';
            else priority = 'normal';
          }

          // 解析依赖项（可能是文本、选项或多选）
          let dependencies: string[] = [];
          if (fields.dependencies) {
            dependencies = parseArrayField(parseStringField(fields.dependencies), []);
          } else if (fields['依赖项']) {
            dependencies = parseArrayField(parseStringField(fields['依赖项']), []);
          }

          // 解析状态（下拉选项）
          const statusOption = parseOptionField(fields.status || fields['状态'], true);
          let status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';
          if (typeof statusOption === 'string') {
            const lower = statusOption.toLowerCase();
            if (lower === 'in-progress' || lower === '进行中') status = 'in-progress';
            else if (lower === 'completed' || lower === '已完成') status = 'completed';
            else if (lower === 'blocked' || lower === '阻塞') status = 'blocked';
            else status = 'pending';
          }

          // 解析截止日期
          const deadline = parseDateField(fields.deadline || fields['截止日期']);

          return {
            id: item.record_id,
            name: name,
            projectId: projectId,
            assignedResourceId: assignedResourceId,
            taskType: taskType,
            estimatedHours: estimatedHours,
            priority: priority,
            dependencies: dependencies,
            status: status,
            deadline: deadline,
          };
        });
        log(`[飞书加载] ✅ 加载了 ${result.tasks.length} 个任务`);
      } else {
        log(`[飞书加载] ❌ 加载任务数据失败: ${JSON.stringify(tasksData)}`);
      }
    }

    // 加载项目数据
    if (projectsTableId) {
      log(`[飞书加载] 加载项目数据: table_id=${projectsTableId}`);
      const projectsResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${projectsTableId}/records/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const projectsData = await projectsResponse.json();
      if (projectsData.code === 0 && projectsData.data) {
        log(`[飞书加载] 🔍 项目原始数据示例: ${JSON.stringify(projectsData.data.items[0]?.fields).substring(0, 200)}...`);

        result.projects = projectsData.data.items.map((item: any) => {
          const fields = item.fields;

          // 从任务中提取该项目的资源池
          const projectTasks = result.tasks.filter((t: any) => t.projectId === item.record_id);
          const resourcePool = Array.from(new Set(
            projectTasks
              .map((t: any) => t.assignedResourceId)
              .filter((id: any) => id) // 过滤掉空值
          ));

          // 解析项目名称
          const name = parseStringField(fields.name || fields['项目名称'], `项目_${item.record_id.substring(0, 8)}`);

          // 解析项目描述
          const description = parseStringField(fields.description || fields['项目描述'], '');

          // 解析优先级（下拉选项）
          const priorityOption = parseOptionField(fields.priority || fields['优先级'], true);
          let priority = 5; // 默认 medium
          if (typeof priorityOption === 'string') {
            const lower = priorityOption.toLowerCase();
            if (lower === 'high' || lower === '高' || lower === '紧急') priority = 9;
            else if (lower === 'medium' || lower === '中') priority = 5;
            else if (lower === 'low' || lower === '低') priority = 1;
          } else if (typeof priorityOption === 'number') {
            priority = Math.min(10, Math.max(1, priorityOption));
          }

          // 解析日期字段
          const startDate = parseDateField(fields.startDate || fields['开始日期']);
          const endDate = parseDateField(fields.endDate || fields['结束日期']);
          const deadline = parseDateField(fields.deadline || fields['截止日期']);

          // 解析状态（下拉选项）
          const statusOption = parseOptionField(fields.status || fields['状态'], true);
          let status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';
          if (typeof statusOption === 'string') {
            const lower = statusOption.toLowerCase();
            if (lower === 'in-progress' || lower === '进行中') status = 'in-progress';
            else if (lower === 'completed' || lower === '已完成') status = 'completed';
            else if (lower === 'blocked' || lower === '阻塞') status = 'blocked';
            else status = 'pending';
          }

          return {
            id: item.record_id,
            name: name,
            description: description,
            priority: priority,
            startDate: startDate,
            endDate: endDate,
            deadline: deadline,
            status: status,
            resourcePool: resourcePool.length > 0 ? resourcePool : [], // 确保始终是数组
            color: '#3b82f6', // 默认颜色
            tasks: [], // 空数组
          };
        });
        log(`[飞书加载] ✅ 加载了 ${result.projects.length} 个项目`);
      } else {
        log(`[飞书加载] ❌ 加载项目数据失败: ${JSON.stringify(projectsData)}`);
      }
    }

    log('[飞书加载] ✅ 数据加载完成');
    log(`[飞书加载] 📊 统计: ${result.resources.length} 个人员, ${result.projects.length} 个项目, ${result.tasks.length} 个任务`);

    return NextResponse.json({
      success: true,
      data: result,
      stats: {
        resources: result.resources.length,
        projects: result.projects.length,
        tasks: result.tasks.length,
      },
    });
  } catch (error: any) {
    log(`[飞书加载] ❌ 加载数据时出错: ${error.message}`);
    log(`[飞书加载] 错误堆栈: ${error.stack}`);

    return NextResponse.json(
      {
        error: '加载数据失败',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
