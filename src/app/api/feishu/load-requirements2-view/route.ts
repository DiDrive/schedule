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

function parseFirstStringField(
  fields: Record<string, any>,
  keys: string[],
  defaultValue: string = ''
): string {
  for (const key of keys) {
    if (!key) continue;
    const value = parseStringField(fields[key], '');
    if (value && value.trim()) return value.trim();
  }
  return defaultValue;
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
  viewId?: string,
  pageSize: number = 500
): Promise<{ records: any[]; pageCount: number }> {
  const allRecords: any[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 50;

  while (pageCount < maxPages) {
    pageCount++;

    // 构建 GET 请求 URL，添加 view_id 参数
    let url = `${baseUrl}?page_size=${pageSize}`;
    if (viewId) {
      url += `&view_id=${encodeURIComponent(viewId)}`;
    }
    if (pageToken) {
      url += `&page_token=${pageToken}`;
    }

    log(`[视图筛选-List] 第 ${pageCount} 次请求, view_id=${viewId || '(none)'}`);

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
    const hasMore = Boolean(data.data?.has_more);
    const nextToken = data.data?.page_token as string | undefined;

    if (items.length === 0) {
      log(`[视图筛选-List] 本页无数据，读取完成`);
      break;
    }

    allRecords.push(...items);
    log(`[视图筛选-List] ✅ 本次获取 ${items.length} 条，累计 ${allRecords.length} 条`);

    if (!hasMore) {
      log(`[视图筛选-List] 已到达最后一页（has_more=false），读取完成`);
      break;
    }

    if (!nextToken) {
      log(`[视图筛选-List] has_more=true 但无 page_token，读取完成`);
      break;
    }

    pageToken = nextToken;
  }

  log(`[视图筛选-List] 完成，共 ${pageCount} 页，${allRecords.length} 条记录`);
  return { records: allRecords, pageCount };
}

async function listTableViews(
  appToken: string,
  tableId: string,
  appAccessToken: string
): Promise<Array<{ view_id?: string; view_name?: string; view_type?: string; is_personal?: boolean }>> {
  try {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/views?page_size=200`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${appAccessToken}` },
    });
    const data = await response.json();
    if (data.code !== 0) {
      log(`[矩阵日历视图] ⚠️ 列出视图失败: ${JSON.stringify(data)}`);
      return [];
    }
    return (data.data?.items || []) as Array<{ view_id?: string; view_name?: string; view_type?: string; is_personal?: boolean }>;
  } catch (e) {
    log(`[矩阵日历视图] ⚠️ 列出视图异常: ${String(e)}`);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const debug = searchParams.get('debug') === '1';

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

    // 校验 viewId 是否属于该表，避免“表/视图不匹配”导致数据看起来变少
    const views = await listTableViews(appToken, requirements2TableId, appAccessToken);
    const matchedView = views.find((v) => String(v.view_id || '').trim() === String(viewId).trim());
    if (matchedView) {
      log(`[矩阵日历视图] 视图信息: name=${matchedView.view_name || ''}, type=${matchedView.view_type || ''}, is_personal=${String(matchedView.is_personal)}`);
    }
    if (views.length > 0 && !views.some((v) => String(v.view_id || '').trim() === String(viewId).trim())) {
      return NextResponse.json(
        {
          error: `视图ID不属于该数据表。请检查 requirements2_table_id 是否正确，或重新复制该表的视图ID。\n\n当前 table_id=${requirements2TableId}, view_id=${viewId}`,
          availableViews: views.map((v) => ({
            viewId: v.view_id,
            name: v.view_name,
            type: v.view_type,
            isPersonal: v.is_personal,
          })),
        },
        { status: 400 }
      );
    }

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
    const { records: viewRecords, pageCount: viewPageCount } = await fetchRecordsByView(req2Url, req2Headers, viewId, 500);

    // 兼容：某些情况下（个人视图 / 权限限制 / view_id 未生效）会导致返回条数显著偏少
    // 这里做一次兜底：如果全表记录明显多于视图返回，则改用全表记录，保证“不漏任务”
    let usedFallback = false;
    let fallbackReason: string | undefined;
    let req2PageCount = viewPageCount;
    let req2Records = viewRecords;

    const shouldTryFallback =
      Boolean(matchedView?.is_personal) ||
      (Array.isArray(viewRecords) && viewRecords.length > 0 && viewRecords.length < 60);

    if (shouldTryFallback) {
      log(`[矩阵日历视图] 视图返回 ${viewRecords.length} 条，尝试兜底读取全表记录...`);
      const { records: allRecords, pageCount: allPageCount } = await fetchRecordsByView(req2Url, req2Headers, undefined, 500);
      if (Array.isArray(allRecords) && allRecords.length > viewRecords.length) {
        usedFallback = true;
        req2Records = allRecords;
        req2PageCount = allPageCount;
        fallbackReason = matchedView?.is_personal
          ? 'personal_view_fallback'
          : 'view_records_suspiciously_low';
        log(`[矩阵日历视图] ✅ 兜底生效：全表 ${allRecords.length} 条（原视图 ${viewRecords.length} 条）`);
      } else {
        log(`[矩阵日历视图] 兜底未生效：全表 ${allRecords.length} 条（原视图 ${viewRecords.length} 条）`);
      }
    }

    if (req2Records.length === 0) {
      log(`[矩阵日历视图] ⚠️ 视图无数据`);
      return NextResponse.json({
        success: true,
        tasks: [],
        projects: [],
        viewRecordCount: 0,
        viewMeta: matchedView
          ? { viewId: matchedView.view_id, name: matchedView.view_name, type: matchedView.view_type, isPersonal: matchedView.is_personal }
          : { viewId },
        debug: debug ? { pages: req2PageCount, usedFallback, fallbackReason } : undefined,
      });
    }

    log(`[矩阵日历视图] ✅ 获取 ${req2Records.length} 条记录`);

    // 提取项目和任务
    const projectMap = new Map<string, any>();
    const projectNameToIdMap = new Map<string, string>();

    // 先提取项目（使用"项目大分类"作为项目名称）
    req2Records.forEach((item: any) => {
      const fields = item.fields;
      const rawProjectName = parseStringField(fields['项目大分类'], '').trim();
      const categoryForFallback = parseStringField(fields['需求类目'], '').trim();
      const fallbackProjectName = categoryForFallback ? categoryForFallback.split('-')[0].trim() : '';
      const projectName = rawProjectName || fallbackProjectName || '默认项目';
      if (projectName && !projectMap.has(projectName)) {
        const projectId = `project-${projectName}`;
        projectMap.set(projectName, {
          id: projectId,
          name: projectName,
          description: parseFirstStringField(fields, ['分类', '项目描述', 'description'], ''),
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
      const taskId = `mx_${viewId}_${item.record_id}`;

      const taskName = parseStringField(fields['脚本名称'] || fields['需求项目'] || fields['需求名称'] || fields['任务名称'] || fields['name'], `需求2_${index + 1}`);
      // 项目大分类作为 projectName
      const category = parseStringField(fields['需求类目'], '').trim();
      const rawProjectName = parseStringField(fields['项目大分类'], '').trim();
      const fallbackProjectName = category ? category.split('-')[0].trim() : '';
      const projectName = rawProjectName || fallbackProjectName || '默认项目';
      const projectId = projectNameToIdMap.get(projectName) || '';
      // 需求类目作为 category
      const subType = parseStringField(fields['细分类'], '');
      const projectProgress = parseStringField(fields['项目进展'], '').trim();

      if (subType.includes('配音')) {
        return null;
      }
      if (projectProgress === '已验收待打包') {
        return null;
      }

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

      const status: 'pending' | 'in-progress' | 'completed' | 'blocked' = 'pending';

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
        category,
        businessMonth: parseStringField(fields['商务月份'], ''),
        subType,
        language: parseStringField(fields['语言'], ''),
        dubbing: parseStringField(fields['配音'], ''),
        contactPerson: parseStringField(fields['对接人'], ''),
        taskSource: 'matrix_view',
        sourceViewId: viewId,
      };
    }).filter(Boolean);

    const projects = Array.from(projectMap.values());

    log(`[矩阵日历视图] ✅ 处理完成: ${tasks.length} 个任务, ${projects.length} 个项目`);

    return NextResponse.json({
      success: true,
      tasks,
      projects,
      viewRecordCount: req2Records.length,
      viewMeta: matchedView
        ? { viewId: matchedView.view_id, name: matchedView.view_name, type: matchedView.view_type, isPersonal: matchedView.is_personal }
        : { viewId },
      debug: debug ? { pages: req2PageCount, usedFallback, fallbackReason, viewRecordsCount: viewRecords.length } : undefined,
    });

  } catch (error) {
    log(`[矩阵日历视图] ❌ 错误: ${error}`);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
