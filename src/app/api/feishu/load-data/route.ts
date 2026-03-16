import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';
import { workorderRecordToTask } from '@/lib/feishu-data-mapper';
import {
  parsePersonName,
  parsePersonId,
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
 * - table_type: 表格类型（'tasks' 标准任务表 或 'workorders' 工单表）
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
    const tableType = searchParams.get('table_type') || 'tasks';
    
    // 判断是否为工单表模式
    const isWorkorderMode = tableType === 'workorders';
    log(`[飞书加载] 加载模式: ${isWorkorderMode ? '工单表' : '标准任务表'}`);

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

    // ===== 第一步：加载人员数据 =====
    if (resourcesTableId) {
      log(`[飞书加载] 步骤1：加载人员数据: table_id=${resourcesTableId}`);
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
        const sample = resourcesData.data.items[0]?.fields;
        log(`[飞书加载] 🔍 人员原始数据示例: ${JSON.stringify(sample).substring(0, 300)}...`);

        result.resources = resourcesData.data.items.map((item: any) => {
          const fields = item.fields;

          // 解析人员ID：可能是文本数组格式 [{text: "res-1", type: "text"}] 或直接字符串
          const personId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']);

          // 解析人员姓名：从飞书人员字段中提取名字
          const personName = parsePersonName(fields['姓名'] || fields['name'] || fields['人员']);

          // 解析工作类型：下拉选项，飞书返回的是字符串（如"平面设计"、"后期制作"）
          const workTypeRaw = parseStringField(fields['工作类型'] || fields['workType'], '');
          // 映射工作类型：平面设计 -> 平面, 后期制作 -> 后期
          let workType = '';
          if (workTypeRaw) {
            if (workTypeRaw.includes('平面')) workType = '平面';
            else if (workTypeRaw.includes('后期')) workType = '后期';
            else workType = workTypeRaw;
          }

          // 解析资源等级：下拉选项
          const level = parseStringField(fields['等级'] || fields['level'], '');

          // 解析效率系数
          const efficiency = parseNumberField(fields['效率'] || fields['efficiency'], 1.0);

          // 解析可用性：0-100 → 0-1
          const availability = parseNumberField(fields['可用性'] || fields['availability'], 100) / 100;

          // 解析时薪
          const hourlyRate = parseNumberField(fields['时薪'] || fields['hourlyRate'], 0);

          // 解析邮箱
          const email = parseStringField(fields['邮箱'] || fields['email'], '');

          // 如果没有指定 ID，使用 personId 或 record_id
          const resourceId = personId || `res_${item.record_id.substring(0, 8)}`;

          // 如果没有指定名称，使用 personName 或 record_id
          const name = personName || resourceId;

          // 提取飞书人员ID：优先从"飞书用户ID"字段获取，如果没有则尝试"姓名"字段
          let feishuPersonId: string | string[] = '';
          
          // 首先尝试从"飞书用户ID"字段获取（人员类型）
          const feishuUserField = fields['飞书用户ID'] || fields['feishu_user'] || fields['飞书用户'];
          if (feishuUserField) {
            feishuPersonId = parsePersonId(feishuUserField);
            if (feishuPersonId) {
              log(`[飞书加载] 从"飞书用户ID"字段提取到飞书人员ID: ${feishuPersonId}`);
            }
          }
          
          // 如果没有找到，尝试从"姓名"字段获取（兼容旧数据）
          if (!feishuPersonId) {
            const nameField = fields['姓名'] || fields['name'] || fields['人员'];
            feishuPersonId = parsePersonId(nameField);
            if (feishuPersonId) {
              log(`[飞书加载] 从"姓名"字段提取到飞书人员ID: ${feishuPersonId}`);
            }
          }

          log(`[飞书加载] 处理人员: ${name} (ID: ${resourceId}, 工作类型: ${workType})`);
          log(`[飞书加载]   最终提取的飞书人员ID: ${feishuPersonId || '未设置'}`);

          return {
            id: resourceId,
            name: name,
            type: 'human',
            workType: workType,
            level: level,
            efficiency: efficiency,
            skills: [], // 技能暂不提取
            availability: availability,
            hourlyRate: hourlyRate,
            email: email,
            color: '#64748b', // 默认颜色
            // 保存飞书人员 ID，用于后续映射
            feishuPersonId: feishuPersonId,
          };
        });
        log(`[飞书加载] ✅ 加载了 ${result.resources.length} 个人员`);
        log(`[飞书加载] 人员列表: ${result.resources.map((r: any) => r.name).join(', ')}`);
      } else {
        log(`[飞书加载] ❌ 加载人员数据失败: ${JSON.stringify(resourcesData)}`);
      }
    }

    // ===== 第二步：加载项目数据，创建项目名称到ID的映射表 =====
    const projectNameToIdMap = new Map<string, string>();

    if (projectsTableId) {
      log(`[飞书加载] 步骤2：加载项目数据: table_id=${projectsTableId}`);
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
        const sample = projectsData.data.items[0]?.fields;
        log(`[飞书加载] 🔍 项目原始数据示例: ${JSON.stringify(sample).substring(0, 300)}...`);

        result.projects = projectsData.data.items.map((item: any) => {
          const fields = item.fields;

          // 解析项目ID：可能是文本数组格式 [{text: "proj-xxx", type: "text"}] 或直接字符串
          const projectId = parseStringField(fields['项目ID'] || fields['id'] || fields['ID']);

          // 解析项目名称：直接字符串
          const name = parseStringField(fields['项目名称'] || fields['name'] || fields['名称'], projectId || `项目_${item.record_id.substring(0, 8)}`);

          // 创建项目名称到 ID 的映射（用于任务数据映射）
          if (name && projectId) {
            projectNameToIdMap.set(name, projectId);
          }

          // 解析项目描述：可能是文本数组格式或直接字符串
          const description = parseStringField(fields['项目描述'] || fields['description'], '');

          // 解析优先级：下拉选项，飞书返回的是字符串（如"紧急"、"普通"、"低"）
          const priorityStr = parseStringField(fields['优先级'] || fields['priority'], '普通');
          let priority: 'urgent' | 'normal' | 'low' = 'normal'; // 默认 normal
          if (priorityStr) {
            if (priorityStr === '紧急') priority = 'urgent';
            else if (priorityStr === '普通') priority = 'normal';
            else if (priorityStr === '低') priority = 'low';
            // 兼容旧值
            else if (priorityStr === '高' || priorityStr === 'high') priority = 'urgent';
            else if (priorityStr === '中' || priorityStr === 'medium') priority = 'normal';
          }

          // 解析日期字段：时间戳或日期字符串或文本数组格式
          const startDate = parseDateField(fields['开始日期'] || fields['startDate']);
          const endDate = parseDateField(fields['结束日期'] || fields['endDate']);
          const deadline = parseDateField(fields['截止日期'] || fields['deadline']);

          // 解析状态：下拉选项，飞书返回的是字符串（如"进行中"、"已完成"）
          const statusStr = parseStringField(fields['项目状态'] || fields['状态'] || fields['status'], 'pending');
          let status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';
          if (statusStr) {
            const lower = statusStr.toLowerCase();
            if (lower === 'in-progress' || lower === '进行中') status = 'in-progress';
            else if (lower === 'completed' || lower === '已完成') status = 'completed';
            else if (lower === 'blocked' || lower === '阻塞') status = 'blocked';
            else status = 'pending';
          }

          return {
            id: projectId || item.record_id,
            name: name,
            description: description,
            priority: priority,
            startDate: startDate,
            endDate: endDate,
            deadline: deadline,
            status: status,
            resourcePool: [], // 稍后从任务中提取
            color: '#3b82f6', // 默认颜色
            tasks: [], // 空数组
          };
        });
        log(`[飞书加载] ✅ 加载了 ${result.projects.length} 个项目`);
        log(`[飞书加载] 📝 项目名称到ID映射: ${Array.from(projectNameToIdMap.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      } else {
        log(`[飞书加载] ❌ 加载项目数据失败: ${JSON.stringify(projectsData)}`);
      }
    }

    // ===== 第三步：加载任务数据，使用映射表转换字段 =====
    if (tasksTableId) {
      log(`[飞书加载] 步骤3：加载任务数据: table_id=${tasksTableId}`);
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
        const sample = tasksData.data.items[0]?.fields;
        log(`[飞书加载] 🔍 任务原始数据示例: ${JSON.stringify(sample).substring(0, 300)}...`);

        // 根据模式选择转换方式
        if (isWorkorderMode) {
          // 工单表模式：使用 workorderRecordToTask 转换
          result.tasks = tasksData.data.items.map((item: any) => {
            return workorderRecordToTask(item, item.record_id);
          });
          log(`[飞书加载] ✅ 使用工单表模式加载了 ${result.tasks.length} 个任务`);
        } else {
          // 标准任务表模式：使用原有逻辑
          result.tasks = tasksData.data.items.map((item: any) => {
            const fields = item.fields;

            // 解析任务ID：可能是文本数组格式 [{text: "task-xxx", type: "text"}] 或直接字符串
            const taskId = parseStringField(fields['任务ID'] || fields['id'] || fields['ID']);

            // 解析任务名称：直接字符串
            const name = parseStringField(fields['任务名称'] || fields['name'] || fields['名称'], taskId || `任务_${item.record_id.substring(0, 8)}`);

            // 解析所属项目：使用项目名称到ID的映射表转换
            const projectName = parseStringField(fields['所属项目'] || fields['项目ID'] || fields['项目'] || fields['projectId']);
            const projectId = projectName ? (projectNameToIdMap.get(projectName) || projectName) : '';

            // 解析负责人：从飞书人员字段中提取 ID，然后映射到系统资源 ID
            const assigneeField = fields['负责人'] || fields['指定人员'] || fields['assignedResourceId'];
            const feishuPersonId = parsePersonId(assigneeField);

            // 调试：输出负责人字段的原始数据
            log(`[飞书加载] 任务 ${name}: 负责人字段原始数据: ${JSON.stringify(assigneeField)}`);
            log(`[飞书加载] 任务 ${name}: 解析出的飞书人员ID: ${feishuPersonId || '空'}`);

            // 将飞书人员 ID 映射到系统资源 ID
            let fixedResourceId = '';
            let assigneeName = '';
            if (feishuPersonId) {
              // 调试：输出所有资源的 feishuPersonId
              const resourceFeishuIds = result.resources.map((r: any) => ({
                name: r.name,
                feishuPersonId: r.feishuPersonId || '未设置',
                resourceId: r.id
              }));
              log(`[飞书加载] 任务 ${name}: 所有资源的飞书人员ID: ${JSON.stringify(resourceFeishuIds)}`);

              const matchedResource = result.resources.find((r: any) => r.feishuPersonId === feishuPersonId);
              fixedResourceId = matchedResource?.id || '';
              assigneeName = matchedResource?.name || '';

              if (matchedResource) {
                log(`[飞书加载] 任务 ${name}: ✓ 成功匹配负责人 - ${assigneeName} (资源ID: ${fixedResourceId})`);
              } else {
                log(`[飞书加载] 任务 ${name}: ✗ 匹配失败 - 飞书人员ID ${feishuPersonId} 未在资源列表中找到`);
                log(`[飞书加载] 任务 ${name}: 请检查飞书任务表的"负责人"字段和人员表的"姓名"字段是否引用同一个人`);
              }
            } else {
              log(`[飞书加载] 任务 ${name}: 未设置负责人字段`);
            }

            // 解析任务类型：下拉选项，飞书返回的是字符串（如"平面设计"、"后期制作"）
            // 映射任务类型：平面设计 -> 平面, 后期制作 -> 后期
            const taskTypeRaw = parseStringField(fields['任务类型'] || fields['taskType'], '');
            let taskType = '';
            if (taskTypeRaw) {
              if (taskTypeRaw.includes('平面')) taskType = '平面';
              else if (taskTypeRaw.includes('后期')) taskType = '后期';
              else if (taskTypeRaw.includes('物料')) taskType = '物料';
              else taskType = taskTypeRaw;
            }

            // 解析预估工时：可能是数字或文本数组格式
            const estimatedHours = parseNumberField(fields['预估工时'] || fields['estimatedHours'], 8);
            
            // 解析平面工时和后期工时
            const estimatedHoursGraphic = parseNumberField(fields['平面工时'] || fields['estimatedHoursGraphic'], 0);
            const estimatedHoursPost = parseNumberField(fields['后期工时'] || fields['estimatedHoursPost'], 0);
            
            // 解析子任务依赖模式：并行或串行
            const subTaskDependencyModeRaw = parseStringField(fields['子任务依赖'] || fields['subTaskDependencyMode'], 'parallel');
            const subTaskDependencyMode: 'parallel' | 'serial' = subTaskDependencyModeRaw === '串行' ? 'serial' : 'parallel';
            
            // 解析扩展字段
            const sequence = parseNumberField(fields['编号'] || fields['sequence'], 0);
            const qualityLevelRaw = parseStringField(fields['质量等级'] || fields['qualityLevel'], '');
            let qualityLevel: 'excellent' | 'good' | 'medium' | 'poor' | undefined = undefined;
            if (qualityLevelRaw) {
              if (qualityLevelRaw === '优秀' || qualityLevelRaw === 'excellent') qualityLevel = 'excellent';
              else if (qualityLevelRaw === '良好' || qualityLevelRaw === 'good') qualityLevel = 'good';
              else if (qualityLevelRaw === '中等' || qualityLevelRaw === 'medium') qualityLevel = 'medium';
              else if (qualityLevelRaw === '差' || qualityLevelRaw === 'poor') qualityLevel = 'poor';
            }
            const cooperationStatus = parseStringField(fields['配合状态'] || fields['cooperationStatus'], '');
            const contactPerson = parseStringField(fields['对接人'] || fields['contactPerson'], '');
            const projectSize = parseStringField(fields['项目大小'] || fields['projectSize'], '');

            // 解析优先级：下拉选项，飞书返回的是字符串（如"紧急"、"普通"、"低"）
            const priorityStr = parseStringField(fields['优先级'] || fields['priority'], '普通');
            let priority: 'urgent' | 'normal' | 'low' = 'normal';
            if (priorityStr) {
              if (priorityStr === '紧急') priority = 'urgent';
              else if (priorityStr === '普通') priority = 'normal';
              else if (priorityStr === '低') priority = 'low';
              // 兼容旧值
              else if (priorityStr === '高' || priorityStr === 'high') priority = 'urgent';
              else if (priorityStr === '中' || priorityStr === 'medium') priority = 'normal';
            }

            // 解析依赖关系：字符串数组（任务名称），需要转换为任务 ID
            const dependencyNames = parseArrayField(fields['依赖关系'] || fields['依赖项'] || fields['dependencies'], []);
            // 暂时保留任务名称，稍后可以转换为任务 ID

            // 解析状态：下拉选项，飞书返回的是字符串（如"进行中"、"已完成"）
            const statusStr = parseStringField(fields['任务状态'] || fields['状态'] || fields['status'], 'pending');
            let status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';
            if (statusStr) {
              const lower = statusStr.toLowerCase();
              if (lower === 'in-progress' || lower === '进行中') status = 'in-progress';
              else if (lower === 'completed' || lower === '已完成') status = 'completed';
              else if (lower === 'blocked' || lower === '阻塞') status = 'blocked';
              else status = 'pending';
            }

            // 解析截止日期：时间戳或日期字符串
            const deadline = parseDateField(fields['截止日期'] || fields['deadline']);

            return {
              id: taskId || item.record_id,
              name: name,
              projectId: projectId,
              assignedResources: fixedResourceId ? [fixedResourceId] : [], // 设置 assignedResources 以便排期算法使用
              fixedResourceId: fixedResourceId, // 设置 fixedResourceId 以便任务管理中显示
              taskType: taskType,
              estimatedHours: estimatedHours,
              estimatedHoursGraphic: estimatedHoursGraphic || undefined,
              estimatedHoursPost: estimatedHoursPost || undefined,
              subTaskDependencyMode: subTaskDependencyMode,
              priority: priority,
              dependencies: dependencyNames, // 暂时保留任务名称
              status: status,
              deadline: deadline,
              // 扩展字段
              sequence: sequence || undefined,
              qualityLevel: qualityLevel,
              cooperationStatus: cooperationStatus || undefined,
              contactPerson: contactPerson || undefined,
              projectSize: projectSize || undefined,
            };
          });
          log(`[飞书加载] ✅ 使用标准任务表模式加载了 ${result.tasks.length} 个任务`);
        }

        // 统计负责人映射结果
        const tasksWithAssignee = result.tasks.filter((t: any) => t.fixedResourceId);
        const tasksWithoutAssignee = result.tasks.filter((t: any) => !t.fixedResourceId);

        log(`[飞书加载] 📊 负责人映射统计:`);
        log(`[飞书加载]   - 总任务数: ${result.tasks.length}`);
        log(`[飞书加载]   - 已设置负责人: ${tasksWithAssignee.length}`);
        log(`[飞书加载]   - 未设置负责人: ${tasksWithoutAssignee.length}`);

        // 列出已设置负责人的任务
        if (tasksWithAssignee.length > 0) {
          log(`[飞书加载] ✓ 已设置负责人的任务:`);
          tasksWithAssignee.forEach((t: any) => {
            const resource = result.resources.find((r: any) => r.id === t.fixedResourceId);
            log(`[飞书加载]   - ${t.name}: ${resource?.name || '未找到'}`);
          });
        }

        // 列出未设置负责人的任务
        if (tasksWithoutAssignee.length > 0) {
          log(`[飞书加载] ℹ️ 未设置负责人的任务 (将自动分配):`);
          tasksWithoutAssignee.forEach((t: any) => {
            log(`[飞书加载]   - ${t.name}`);
          });
        }
      } else {
        log(`[飞书加载] ❌ 加载任务数据失败: ${JSON.stringify(tasksData)}`);
      }
    }

    // ===== 第四步：从任务中提取项目的资源池 =====
    result.projects.forEach((project: any) => {
      const projectTasks = result.tasks.filter((t: any) => t.projectId === project.id);
      const resourcePool = Array.from(new Set(
        projectTasks
          .map((t: any) => t.fixedResourceId)
          .filter((id: any) => id) // 过滤掉空值
      ));
      project.resourcePool = resourcePool;
      project.tasks = []; // 空数组
    });

    // ===== 第五步：将任务名称依赖转换为任务ID =====
    const taskNameToIdMap = new Map<string, string>();
    result.tasks.forEach((task: any) => {
      taskNameToIdMap.set(task.name, task.id);
    });

    result.tasks.forEach((task: any) => {
      if (task.dependencies && Array.isArray(task.dependencies)) {
        task.dependencies = task.dependencies
          .map((depName: string) => taskNameToIdMap.get(depName))
          .filter((id: any) => id); // 过滤掉找不到的
      }
    });

    log('[飞书加载] ✅ 数据加载完成');
    log(`[飞书加载] 📊 统计: ${result.resources.length} 个人员, ${result.projects.length} 个项目, ${result.tasks.length} 个任务`);

    // 统计负责人映射
    const tasksWithAssignee = result.tasks.filter((t: any) => t.fixedResourceId);
    const tasksWithoutAssignee = result.tasks.filter((t: any) => !t.fixedResourceId);

    return NextResponse.json({
      success: true,
      data: result,
      stats: {
        resources: result.resources.length,
        projects: result.projects.length,
        tasks: result.tasks.length,
        tasksWithAssignee: tasksWithAssignee.length,
        tasksWithoutAssignee: tasksWithoutAssignee.length,
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
