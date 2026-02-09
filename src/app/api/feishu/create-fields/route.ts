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
  'link': 17,         // 关联字段
  'reference': 17,    // 关联字段
};

// 获取现有字段
async function getExistingFields(
  appToken: string,
  tableId: string,
  accessToken: string
): Promise<Record<string, string>> {
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
  const fields: Record<string, string> = {};

  if (data.code === 0 && data.data?.items) {
    data.data.items.forEach((field: any) => {
      fields[field.field_name] = field.field_id;
    });
  }

  return fields;
}

// 创建字段
async function createField(
  appToken: string,
  tableId: string,
  fieldId: string,
  fieldName: string,
  fieldType: string,
  accessToken: string,
  options?: string[],
  relatedTableId?: string // 关联表格 ID（用于关联字段）
): Promise<{ success: boolean; message: string }> {
  const mappedType = fieldTypeMap[fieldType] || 1;

  // 检查字段是否已存在
  const existingFields = await getExistingFields(appToken, tableId, accessToken);
  if (existingFields[fieldName]) {
    return {
      success: true,
      message: `字段 ${fieldName} 已存在，跳过创建`,
    };
  }

  const requestBody: any = {
    table_id: tableId,
    field: {
      field_name: fieldName,
      type: mappedType,
      is_required: false,
      property: {},
    },
  };

  // 处理关联字段
  if ((fieldType === 'link' || fieldType === 'reference') && relatedTableId) {
    requestBody.field.type = 17; // 关联字段类型
    requestBody.field.property = {
      related_table_id: relatedTableId,
      foreign_key: 'record_id', // 关联类型
      is_multiple: false, // 是否允许多选关联
      is_cascade: false, // 是否级联删除关联记录
      is_bidirectional: false, // 是否双向关联
    };
  }

  // 处理单选和多选选项
  if ((fieldType === 'singleSelect' || fieldType === 'multiSelect') && options && options.length > 0) {
    requestBody.field.type = fieldType === 'singleSelect' ? 3 : 4;
    requestBody.field.property.options = options.map(opt => ({
      name: opt,
    }));
  }

  // 处理百分比类型
  if (fieldType === 'percent') {
    requestBody.field.type = 2; // 数字类型
    requestBody.field.property.formatter = '{0.00}%';
  }

  // 处理日期时间类型
  if (fieldType === 'datetime') {
    requestBody.field.property.date_formatter = 'yyyy-MM-dd HH:mm:ss';
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
    // 返回详细的错误信息
    const errorMessage = `创建字段 ${fieldName} 失败 (code: ${data.code}): ${data.msg}`;
    console.error('创建字段失败:', errorMessage);
    console.error('请求体:', JSON.stringify(requestBody, null, 2));
    console.error('响应:', JSON.stringify(data, null, 2));

    return {
      success: false,
      message: errorMessage,
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
          // 确定关联表格 ID
          let relatedTableId: string | undefined;

          if (field.fieldId === 'project') {
            // project 字段关联到项目表
            relatedTableId = config.tableIds.projects;
          }

          const result = await createField(
            config.appToken,
            table.tableId,
            field.fieldId,
            field.fieldName,
            field.fieldType,
            accessToken,
            field.options,
            relatedTableId
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
