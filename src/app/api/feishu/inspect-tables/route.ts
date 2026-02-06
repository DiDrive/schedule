/**
 * 飞书表格字段检测 API
 * 通过后端代理调用飞书 API，避免浏览器 CORS 限制
 */

import { NextRequest, NextResponse } from 'next/server';
import { type FeishuConfig } from '@/lib/feishu-client';

interface FieldInfo {
  fieldId: string;
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
}

interface TableInfo {
  tableName: string;
  tableId: string;
  fields: FieldInfo[];
  sampleRecord: any;
  hasError: boolean;
  errorMessage?: string;
}

interface ExpectedFields {
  [key: string]: string; // fieldName -> fieldType
}

// 获取飞书访问令牌
async function getAccessToken(config: FeishuConfig): Promise<string> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取访问令牌失败: ${data.msg}`);
  }

  return data.tenant_access_token;
}

// 获取表格字段
async function getTableFields(
  appToken: string,
  tableId: string,
  accessToken: string
): Promise<{ fields: any[]; sampleRecord: any }> {
  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`获取表格字段失败: ${data.msg}`);
  }

  // 获取一条示例记录
  const sampleResponse = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const sampleData = await sampleResponse.json();

  return {
    fields: data.data?.items || [],
    sampleRecord: sampleData.data?.items?.[0] || null,
  };
}

// 字段类型映射
const fieldTypeMap: { [key: string]: string } = {
  '1': 'text',         // 文本
  '2': 'number',       // 数字
  '3': 'singleSelect', // 单选
  '4': 'multiSelect',  // 多选
  '5': 'date',         // 日期
  '11': 'person',      // 人员
  '15': 'phone',       // 电话
  '17': 'url',         // 超链接
  '18': 'email',       // 邮箱
  '19': 'checkbox',    // 复选框
  '20': 'progress',    // 进度
  '21': 'rating',      // 评分
  '22': 'currency',    // 货币
  '23': 'dateTime',    // 日期时间
  '1001': 'text',      // 公式（作为文本）
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 获取配置
    const config: FeishuConfig = {
      appId: body.config?.appId || '',
      appSecret: body.config?.appSecret || '',
      appToken: body.config?.appToken || '',
      tableIds: body.config?.tableIds || {
        resources: '',
        projects: '',
        tasks: '',
        schedules: '',
      },
    };

    // 验证配置
    if (!config.appId || !config.appSecret || !config.appToken) {
      return NextResponse.json(
        {
          success: false,
          message: '飞书配置不完整，请检查 App ID、App Secret 和 App Token',
          tableInfo: [],
        },
        { status: 400 }
      );
    }

    // 获取访问令牌
    const accessToken = await getAccessToken(config);

    // 定义需要检查的表格
    const tablesToCheck = [
      { name: '人员表', id: config.tableIds.resources, expected: body.expectedFields?.resources || {} },
      { name: '项目表', id: config.tableIds.projects, expected: body.expectedFields?.projects || {} },
      { name: '任务表', id: config.tableIds.tasks, expected: body.expectedFields?.tasks || {} },
      { name: '排期表', id: config.tableIds.schedules, expected: body.expectedFields?.schedules || {} },
    ];

    const tableInfo: TableInfo[] = [];

    for (const table of tablesToCheck) {
      try {
        // 跳过空 Table ID
        if (!table.id) {
          tableInfo.push({
            tableName: table.name,
            tableId: table.id,
            fields: [],
            sampleRecord: null,
            hasError: true,
            errorMessage: 'Table ID 未配置',
          });
          continue;
        }

        // 获取表格字段
        const { fields, sampleRecord } = await getTableFields(
          config.appToken,
          table.id,
          accessToken
        );

        // 转换字段信息
        const fieldInfos: FieldInfo[] = fields.map(field => ({
          fieldId: field.field_id,
          fieldName: field.field_name,
          fieldType: fieldTypeMap[field.type] || field.type.toString(),
          isRequired: !!field.is_required,
        }));

        // 检查是否有缺失字段
        const missingFields = Object.entries(table.expected)
          .filter(([fieldName]) => !fieldInfos.some(f => f.fieldName === fieldName))
          .map(([fieldName]) => fieldName);

        tableInfo.push({
          tableName: table.name,
          tableId: table.id,
          fields: fieldInfos,
          sampleRecord,
          hasError: missingFields.length > 0,
          errorMessage: missingFields.length > 0
            ? `缺少字段: ${missingFields.join(', ')}`
            : undefined,
        });
      } catch (error) {
        tableInfo.push({
          tableName: table.name,
          tableId: table.id,
          fields: [],
          sampleRecord: null,
          hasError: true,
          errorMessage: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '检测完成',
      tableInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('表格检测失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '表格检测失败',
        tableInfo: [],
      },
      { status: 500 }
    );
  }
}
