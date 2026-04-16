/**
 * 加载需求表2的指定视图数据（用于矩阵日历）
 * GET /api/feishu/load-requirements2-view?view_id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

// 日志函数
function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// 解析字符串字段
function parseStringField(value: any, defaultValue: string = ''): string {
  if (!value) return defaultValue;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      return first.text || first.name || first.label || JSON.stringify(first);
    }
  }
  if (typeof value === 'object' && value !== null) {
    return value.text || value.name || value.label || JSON.stringify(value);
  }
  return String(value) || defaultValue;
}

// 解析数值字段
function parseNumberField(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

// 解析日期字段
function parseDateField(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return isNaN(timestamp) ? undefined : new Date(timestamp);
  }
  return undefined;
}

// 解析人员ID
function parsePersonId(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      return first.id || first.open_id || first.union_id || first.name;
    }
  }
  if (typeof value === 'object' && value !== null) {
    return value.id || value.open_id || value.union_id || value.name;
  }
  return undefined;
}

// 使用 list API（GET）获取所有记录
async function fetchRecordsByView(
  baseUrl: string,
  headers: Record<string, string>,
  viewId: string,
  pageSize: number = 500
): Promise<any[]> {
  const allRecords: any[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 50;

  while (pageCount < maxPages) {
    pageCount++;

    // 构建 GET 请求 URL，添加 view_id 参数
    let url = `${baseUrl}?page_size=${pageSize}&view_id=${encodeURIComponent(viewId)}`;
    if (pageToken) {
      url += `&page_token=${pageToken}`;
    }

    log(`[视图筛选-List] 第 ${pageCount} 次请求, view_id=${viewId}`);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (data.code !== 0) {
      log(`[视图筛选-List] ❌ 请求失败: ${JSON.stringify(data)}`);
      break;
    }

    const items = data.data?.items || [];

    if (items.length === 0) {
      log(`[视图筛选-List] 本页无数据，读取完成`);
      break;
    }

    allRecords.push(...items);
    log(`[视图筛选-List] ✅ 本次获取 ${items.length} 条，累计 ${allRecords.length} 条`);

    // 如果返回条数少于 page_size，说明是最后一页
    if (items.length < pageSize) {
      log(`[视图筛选-List] 已到达最后一页，读取完成`);
      break;
    }

    // 获取下一页 token
    pageToken = data.data?.page_token;
    if (!pageToken) {
      log(`[视图筛选-List] 无page_token，读取完成`);
      break;
    }
  }

  log(`[视图筛选-List] 完成，共 ${pageCount} 页，${allRecords.length} 条记录`);
  return allRecords;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // 获取配置参数
  const appId = searchParams.get('app_id');
  const appSecret = searchParams.get('app_secret');
  const appToken = searchParams.get('app_token');
  const requirements2TableId = searchParams.get('requirements2_table_id');
  const viewId = searchParams.get('view_id');

  // 验证必要参数
  if (!appId || !appSecret || !appToken || !requirements2TableId) {
    return NextResponse.json(
      { error: 'Missing required parameters: app_id, app_secret, app_token, requirements2_table_id' },
      { status: 400 }
    );
  }

  if (!viewId) {
    return NextResponse.json(
      { error: 'Missing required parameter: view_id' },
      { status: 400 }
    );
  }

  log(`[矩阵日历视图] 开始加载需求表2筛选视图数据`);
  log(`[矩阵日历视图] 应用Token: ${appToken.substring(0, 8)}...`);
  log(`[矩阵日历视图] 需求表2 ID: ${requirements2TableId}`);
  log(`[矩阵日历视图] 视图 ID: ${viewId}`);

  try {
    // 获取应用访问令牌
    const appAccessToken = await getAppAccessToken(appId, appSecret);
    log(`[矩阵日历视图] ✅ 获取应用访问令牌成功`);

    // 加载资源（人员）数据
    const resources: any[] = [];
    const resourceMap = new Map<string, string>(); // feishuPersonId -> resourceId
    const personNameMap = new Map<string, string>(); // feishuPersonId -> name

    // 注意：这里需要从主数据源加载人员信息，或者从请求中传入
    // 暂时简化处理，创建一个空的人员列表，后续通过前端传入

    // 加载需求表2的筛选视图数据
    const req2Url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${requirements2TableId}/records`;
    const req2Headers = {
      'Authorization': `Bearer ${appAccessToken}`,
    };

    log(`[矩阵日历视图] 开始加载视图数据...`);
    const req2Records = await fetchRecordsByView(req2Url, req2Headers, viewId, 500);

    if (req2Records.length === 0) {
      log(`[矩阵日历视图] ⚠️ 视图无数据`);
      return NextResponse.json({
        success: true,
        tasks: [],
        projects: [],
        viewRecordCount: 0,
      });
    }

    log(`[矩阵日历视图] ✅ 获取 ${req2Records.length} 条记录`);

    // 提取项目和任务
    const projectMap = new Map<string, any>();
    const projectNameToIdMap = new Map<string, string>();

    // 先提取项目
    req2Records.forEach((item: any) => {
      const fields = item.fields;
      const categoryName = parseStringField(fields['需求类目'] || fields['客户名称'] || fields['customerName'], '');
      const projectName = categoryName || '默认项目';
      if (projectName && !projectMap.has(projectName)) {
        const projectId = `project-${projectName}`;
        projectMap.set(projectName, {
          id: projectId,
          name: projectName,
          description: parseStringField(fields['分类'] || fields['项目描述'], ''),
          priority: 'normal',
          status: 'pending',
          resourcePool: [],
          color: '#3b82f6',
          tasks: [],
        });
        projectNameToIdMap.set(projectName, projectId);
      }
    });

    // 转换为任务格式
    const tasks = req2Records.map((item: any, index: number) => {
      const fields = item.fields;
      const taskId = parseStringField(fields['员工填报用索引编号'] || fields['需求ID'] || fields['任务ID'] || fields['id'] || fields['ID']) || `req2_${item.record_id.substring(0, 8)}`;

      const categoryName = parseStringField(fields['需求类目'] || fields['客户名称'] || fields['customerName'], '');
      const taskName = parseStringField(fields['脚本名称'] || fields['需求项目'] || fields['需求名称'] || fields['任务名称'] || fields['name'], `需求2_${index + 1}`);
      const projectName = categoryName || '默认项目';
      const projectId = projectNameToIdMap.get(projectName) || '';

      const assigneeField = fields['对接人'] || fields['所属'] || fields['负责人'] || fields['指定人员'];
      const feishuPersonId = parsePersonId(assigneeField);

      let assigneeId = '';
      let assigneeName = '';
      if (feishuPersonId && resourceMap.has(feishuPersonId)) {
        assigneeId = resourceMap.get(feishuPersonId) || '';
        assigneeName = personNameMap.get(feishuPersonId) || '';
      }

      const estimatedHoursGraphic = parseNumberField(
        fields['内部平面'] || fields['平面预估工时'] || fields['平面报工耗时'] || fields['平面深加工'],
        undefined
      );
      const estimatedHoursPost = parseNumberField(
        fields['内部后期'] || fields['后期预估工时'] || fields['后期报工耗时'] || fields['后期深加工'],
        undefined
      );
      const totalHours = parseNumberField(
        fields['预估工时'],
        (estimatedHoursGraphic || 0) + (estimatedHoursPost || 0)
      );

      const statusStr = parseStringField(fields['项目进展'] || fields['状态'] || fields['status'], 'pending');
      let status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';
      if (statusStr === '进行中' || statusStr === 'in-progress' || statusStr.includes('进行')) status = 'in-progress';
      else if (statusStr === '已完成' || statusStr === 'completed' || statusStr.includes('完成') || statusStr.includes('验收')) status = 'completed';
      else if (statusStr === '阻塞' || statusStr === 'blocked') status = 'blocked';

      // 根据工时自动推断任务类型
      let taskType: '平面' | '后期' | '' = '';
      const hasGraphic = estimatedHoursGraphic && estimatedHoursGraphic > 0;
      const hasPost = estimatedHoursPost && estimatedHoursPost > 0;
      if (hasGraphic && !hasPost) {
        taskType = '平面';
      } else if (hasPost && !hasGraphic) {
        taskType = '后期';
      }

      let deadline = parseDateField(fields['需求日期'] || fields['截止日期']) ||
                    parseDateField(fields['验收时间']);

      return {
        id: taskId,
        name: taskName,
        projectId,
        projectName,
        taskType,
        estimatedHours: totalHours,
        estimatedHoursGraphic,
        estimatedHoursPost,
        priority: 'normal' as const,
        assigneeId,
        assigneeName,
        deadline,
        status,
        deadlineType: deadline ? 'specified' as const : 'uncertain' as const,
        feishuRecordId: item.record_id,
        category: parseStringField(fields['需求类目'] || fields['分类'], ''),
        businessMonth: parseStringField(fields['商务月份'], ''),
        subType: parseStringField(fields['细分类'], ''),
        language: parseStringField(fields['语言'], ''),
        dubbing: parseStringField(fields['配音'], ''),
        contactPerson: parseStringField(fields['对接人'], ''),
      };
    });

    const projects = Array.from(projectMap.values());

    log(`[矩阵日历视图] ✅ 处理完成: ${tasks.length} 个任务, ${projects.length} 个项目`);

    return NextResponse.json({
      success: true,
      tasks,
      projects,
      viewRecordCount: req2Records.length,
    });

  } catch (error) {
    log(`[矩阵日历视图] ❌ 错误: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
