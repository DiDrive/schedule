/**
 * 飞书表格字段创建 API
 * 在飞书表格中自动创建缺失的字段
 */

import { NextRequest, NextResponse } from 'next/server';
import { type FeishuConfig } from '@/lib/feishu-client';

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

// 字段类型映射
const fieldTypeMap: Record<string, number> = {
  'text': 1,          // 文本
  'number': 2,        // 数字
  'singleSelect': 3,  // 单选
  'multiSelect': 4,   // 多选
  'date': 5,          // 日期
  'person': 11,       // 人员
  'phone': 15,        // 电话
  'url': 17,          // 超链接
  'email': 18,        // 邮箱
  'checkbox': 19,     // 复选框
  'progress': 20,     // 进度
  'rating': 21,       // 评分
  'currency': 22,     // 货币
  'datetime': 23,     // 日期时间
  'percent': 23,      // 百分比（使用日期时间类型，显示时格式化为百分比）
  'link': 17,         // 关联字段（使用超链接类型，实际应为专用类型）
};

// 创建字段
async function createField(
  appToken: string,
  tableId: string,
  fieldId: string,
  fieldName: string,
  fieldType: string,
  options?: string[],
  accessToken: string
): Promise<{ success: boolean; message: string }> {
  const mappedType = fieldTypeMap[fieldType] || 1;

  const requestBody: any = {
    table_id: tableId,
    field: {
      field_name: fieldName,
      type: mappedType,
      is_required: false,
      property: {},
    },
  };

  // 处理单选和多选选项
  if ((fieldType === 'singleSelect' || fieldType === 'multiSelect') && options && options.length > 0) {
    requestBody.field.property.options = options.map(opt => ({
      name: opt,
    }));
  }

  // 处理百分比类型
  if (fieldType === 'percent') {
    requestBody.field.type = 2; // 数字类型
    requestBody.field.property.formatter = '{0.00}%';
  }

  const response = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    return {
      success: false,
      message: `创建字段 ${fieldName} 失败: ${data.msg}`,
    };
  }

  return {
    success: true,
    message: `创建字段 ${fieldName} 成功`,
  };
}

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

    // 获取需要创建的字段
    const fieldsToCreate: Array<{
      tableName: string;
      tableId: string;
      fields: Array<{ fieldId: string; fieldName: string; fieldType: string; options?: string[] }>;
    }> = body.fieldsToCreate || [];

    // 验证配置
    if (!config.appId || !config.appSecret || !config.appToken) {
      return NextResponse.json(
        {
          success: false,
          message: '飞书配置不完整',
          results: [],
        },
        { status: 400 }
      );
    }

    // 获取访问令牌
    const accessToken = await getAccessToken(config);

    const results: Array<{
      tableName: string;
      fieldName: string;
      success: boolean;
      message: string;
    }> = [];

    // 创建字段
    for (const table of fieldsToCreate) {
      for (const field of table.fields) {
        try {
          const result = await createField(
            config.appToken,
            table.tableId,
            field.fieldId,
            field.fieldName,
            field.fieldType,
            field.options,
            accessToken
          );

          results.push({
            tableName: table.tableName,
            fieldName: field.fieldName,
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          results.push({
            tableName: table.tableName,
            fieldName: field.fieldName,
            success: false,
            message: error instanceof Error ? error.message : '未知错误',
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `字段创建完成：成功 ${successCount} 个，失败 ${failCount} 个`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('创建字段失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '创建字段失败',
        results: [],
      },
      { status: 500 }
    );
  }
}
