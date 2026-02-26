import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken } from '@/lib/feishu-api';

/**
 * 测试飞书同步接口是否工作正常
 *
 * 请求参数（通过 URL 传递）:
 * - app_id: 飞书应用 ID
 * - app_secret: 飞书应用密钥
 * - app_token: 多维表格 App Token
 * - schedules_table_id: 排期表 Table ID
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const log: any[] = [];

  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('app_id');
    const appSecret = searchParams.get('app_secret');
    const appToken = searchParams.get('app_token');
    const schedulesTableId = searchParams.get('schedules_table_id');

    log.push({ step: '1. 解析参数', data: { appId: appId?.substring(0, 10) + '...', appSecret: appSecret ? '已填写' : '未填写', appToken: appToken?.substring(0, 10) + '...', schedulesTableId: schedulesTableId?.substring(0, 10) + '...' } });

    // 1. 获取 App Access Token
    const appAccessToken = await getAppAccessToken(appId!, appSecret!);
    log.push({ step: '2. 获取 App Access Token', success: true, token: appAccessToken.substring(0, 20) + '...' });

    // 2. 测试读取排期表
    const listResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 1 }),
      }
    );

    const listData = await listResponse.json();
    log.push({ step: '3. 测试读取排期表', success: listData.code === 0, code: listData.code, msg: listData.msg, itemCount: listData.data?.items?.length || 0 });

    // 3. 测试写入一条测试记录
    const testRecord = {
      fields: {
        '任务名称': '测试任务_' + Date.now(),
        '任务类型': '平面',
        '负责人': [],
        '开始时间': Math.floor(Date.now() / 1000) * 1000,
        '结束时间': Math.floor((Date.now() + 86400000) / 1000) * 1000,
        '预估工时': 8,
        '状态': '待处理',
      },
    };

    const createResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testRecord),
      }
    );

    const createData = await createResponse.json();
    log.push({ step: '4. 测试写入记录', success: createData.code === 0, code: createData.code, msg: createData.msg, recordId: createData.data?.record?.record_id });

    // 如果写入成功，尝试删除测试记录
    if (createData.code === 0 && createData.data?.record?.record_id) {
      const deleteResponse = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${schedulesTableId}/records/${createData.data.record.record_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${appAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const deleteData = await deleteResponse.json();
      log.push({ step: '5. 清理测试记录', success: deleteData.code === 0, code: deleteData.code, msg: deleteData.msg });
    }

    const duration = Date.now() - startTime;
    log.push({ step: '完成', duration: `${duration}ms` });

    return NextResponse.json({
      success: true,
      steps: log,
      summary: {
        accessToken: '✅',
        readTable: listData.code === 0 ? '✅' : '❌',
        writeRecord: createData.code === 0 ? '✅' : '❌',
        deleteRecord: createData.code === 0 ? '✅' : '❌',
      },
    });

  } catch (error) {
    log.push({ step: '错误', error: error instanceof Error ? error.message : '未知错误' });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      steps: log,
    }, { status: 500 });
  }
}
