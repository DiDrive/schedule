import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

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

// 状态映射函数：系统状态 -> 飞书状态
function mapStatusToFeishu(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待处理',
    'in-progress': '进行中',
    'completed': '已完成',
    'blocked': '阻塞',
    'to-confirm': '待确认',
  };
  return statusMap[status] || '待处理';
}

// 带超时的 fetch
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 同步排期结果到飞书排期表
 * 
 * 逻辑：
 * 1. 清空排期表中的旧数据
 * 2. 批量创建所有任务的排期记录（包括子任务）
 * 3. 每个子任务（平面/后期）都有独立的一条记录
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    log(`[飞书同步] ========== 开始同步排期 ==========`);
    log(`[飞书同步] 参数: appId=${appId?.substring(0, 8)}..., appToken=${appToken?.substring(0, 8)}...`);
    log(`[飞书同步] 排期表ID: ${schedulesTableId?.substring(0, 10)}...`);

    if (!appId || !appSecret) {
      return NextResponse.json({ success: false, error: '缺少 app_id 或 app_secret' }, { status: 400 });
    }

    if (!appToken) {
      return NextResponse.json({ success: false, error: '缺少 app_token' }, { status: 400 });
    }

    if (!schedulesTableId) {
      return NextResponse.json({ success: false, error: '缺少排期表 ID (schedules_table_id)' }, { status: 400 });
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      log(`[飞书同步] 没有任务需要同步`);
      return NextResponse.json({ 
        success: true, 
        stats: { success: 0, error: 0 },
        message: '没有任务需要同步'
      });
    }

    log(`[飞书同步] 待同步任务数: ${tasks.length}`);

    // 获取 access token
    let appAccessToken: string;
    try {
      appAccessToken = await getAppAccessToken(appId, appSecret);
      log(`[飞书同步] 获取 access token 成功`);
    } catch (error) {
      log(`[飞书同步] 获取 access token 失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return NextResponse.json({ 
        success: false, 
        error: `获取飞书访问令牌失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }, { status: 500 });
    }

    // 创建资源ID到飞书人员ID的映射表
    const resourceIdToFeishuPersonIdMap = new Map<string, string>();
    const resourcesTableId = searchParams.get('resources_table_id');
    
    if (resourcesTableId) {
      try {
        log(`[飞书同步] 正在加载人员映射...`);
        const resourcesResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${resourcesTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ page_size: 500 }),
          },
          30000
        );

        const resourcesData = await resourcesResponse.json();
        if (resourcesData.code === 0 && resourcesData.data) {
          const { parseStringField, parsePersonId } = require('@/lib/feishu-field-parser');

          resourcesData.data.items.forEach((item: any) => {
            const fields = item.fields;
            const resourceId = parseStringField(fields['人员ID'] || fields['id'] || fields['ID']) || `res_${item.record_id.substring(0, 8)}`;
            const feishuPersonId = parsePersonId(fields['姓名'] || fields['name'] || fields['人员']);

            if (resourceId && feishuPersonId) {
              resourceIdToFeishuPersonIdMap.set(resourceId, feishuPersonId);
            }
          });
          log(`[飞书同步] ✅ 加载了 ${resourceIdToFeishuPersonIdMap.size} 个人员映射`);
        }
      } catch (error) {
        log(`[飞书同步] ⚠️ 加载人员映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    // ===== 第一步：清空排期表中的旧数据 =====
    log(`[飞书同步] 第一步：清空排期表旧数据`);
    try {
      let hasMore = true;
      let pageToken = '';
      let totalDeleted = 0;
      
      while (hasMore) {
        const listResponse = await fetchWithTimeout(
          `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${appAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              page_size: 500,
              page_token: pageToken || undefined 
            }),
          },
          30000
        );

        const listData = await listResponse.json();
        if (listData.code === 0 && listData.data?.items?.length > 0) {
          const recordIds = listData.data.items.map((item: any) => item.record_id);
          
          // 批量删除
          const deleteResponse = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_delete`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: recordIds }),
            },
            30000
          );
          
          const deleteData = await deleteResponse.json();
          if (deleteData.code === 0) {
            totalDeleted += recordIds.length;
          }
          
          // 检查是否有更多数据
          hasMore = listData.data.has_more;
          pageToken = listData.data.page_token || '';
        } else {
          hasMore = false;
        }
      }
      
      log(`[飞书同步] ✅ 清空完成，删除了 ${totalDeleted} 条旧记录`);
    } catch (error) {
      log(`[飞书同步] ⚠️ 清空旧记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    // ===== 第二步：批量创建排期记录 =====
    log(`[飞书同步] 第二步：批量创建排期记录`);
    
    // 准备创建的记录
    const recordsToCreate = tasks.map((task: any) => {
      const feishuPersonId = task.assignedResourceId ? 
        resourceIdToFeishuPersonIdMap.get(task.assignedResourceId) || '' : '';

      // 判断任务类型
      const taskType = task.subTaskType || task.taskType || '';
      
      // 构建记录字段
      const fields: any = {
        // 任务名称
        '任务名称': task.name || '',
        
        // 任务类型（平面/后期）
        '任务类型': taskType,
        
        // 负责人（飞书人员ID）
        '负责人': feishuPersonId ? [{ id: feishuPersonId }] : [],
        
        // 开始时间（时间戳，毫秒）
        '开始时间': task.startDate ? Math.floor(new Date(task.startDate).getTime() / 1000) * 1000 : 0,
        
        // 结束时间
        '结束时间': task.endDate ? Math.floor(new Date(task.endDate).getTime() / 1000) * 1000 : 0,
        
        // 预估工时
        '预估工时': task.estimatedHours || 0,
        
        // 平面工时/后期工时
        '平面工时': task.estimatedHoursGraphic || 0,
        '后期工时': task.estimatedHoursPost || 0,
        
        // 状态
        '状态': mapStatusToFeishu(task.status || 'pending'),
        
        // 所属项目
        '所属项目': task.projectName || '',
      };

      // 截止日期
      if (task.deadline) {
        fields['截止日期'] = Math.floor(new Date(task.deadline).getTime() / 1000) * 1000;
      }
      
      // 建议截止日期
      if (task.suggestedDeadline) {
        fields['建议截止日期'] = Math.floor(new Date(task.suggestedDeadline).getTime() / 1000) * 1000;
      }
      
      // 父任务ID（用于标识子任务）
      if (task.parentTaskId) {
        fields['父任务ID'] = task.parentTaskId;
      }
      
      // 任务ID
      fields['任务ID'] = task.id || '';

      return { fields };
    });

    // 批量创建
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    if (recordsToCreate.length > 0) {
      log(`[飞书同步] 开始批量创建 ${recordsToCreate.length} 条排期记录`);
      
      const batchSize = 500;
      for (let i = 0; i < recordsToCreate.length; i += batchSize) {
        const batch = recordsToCreate.slice(i, i + batchSize);
        log(`[飞书同步] 正在创建第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 条`);
        
        try {
          const response = await fetchWithTimeout(
            `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/batch_create`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ records: batch }),
            },
            60000
          );
          
          const data = await response.json();
          if (data.code === 0 && data.data?.records) {
            successCount += data.data.records.length;
            log(`[飞书同步] ✅ 批量创建成功: ${data.data.records.length} 条`);
          } else {
            errorCount += batch.length;
            errors.push(`批量创建失败: ${data.msg}`);
            log(`[飞书同步] ⚠️ 批量创建失败: ${data.msg}, code: ${data.code}`);
          }
        } catch (error) {
          errorCount += batch.length;
          errors.push(`批量创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
          log(`[飞书同步] ⚠️ 批量创建异常: ${error instanceof Error ? error.message : '未知错误'}`);
        }
        
        // 批次间等待100ms
        if (i + batchSize < recordsToCreate.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const elapsed = Date.now() - startTime;
    log(`[飞书同步] ========== 同步完成 ==========`);
    log(`[飞书同步] 耗时: ${elapsed}ms, 成功: ${successCount}, 失败: ${errorCount}`);

    return NextResponse.json({
      success: true,
      stats: { success: successCount, error: errorCount },
      errors: errors.length > 0 ? errors : undefined,
      elapsed,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[飞书同步] ❌ 同步异常: ${errorMessage}`);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
