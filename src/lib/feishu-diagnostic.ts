/**
 * 飞书同步诊断工具
 * 帮助诊断飞书同步问题
 */

import { getAccessToken } from './feishu-client';
import { FEISHU_FIELD_IDS } from './feishu-data-mapper';

export interface DiagnosticResult {
  tableName: string;
  tableId: string;
  hasTable: boolean;
  missingFields: string[];
  invalidFields: string[];
  validFields: string[];
  errors: string[];
}

/**
 * 诊断飞书表格配置
 */
export async function diagnoseTable(
  appToken: string,
  tableId: string,
  tableName: string
): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    tableName,
    tableId,
    hasTable: false,
    missingFields: [],
    invalidFields: [],
    validFields: [],
    errors: [],
  };

  try {
    const token = await getAccessToken();

    // 获取表格字段列表
    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (data.code !== 0) {
      result.errors.push(`获取字段列表失败: ${data.msg}`);
      return result;
    }

    result.hasTable = true;

    // 获取现有的字段
    const existingFields = data.data?.items || [];
    const existingFieldMap = new Map<string, any>();

    existingFields.forEach((field: any) => {
      existingFieldMap.set(field.field_name, field);
    });

    console.log(`[诊断] ${tableName} 现有字段:`, Array.from(existingFieldMap.keys()));

    // 确定应该检查哪些字段
    let expectedFields: Record<string, string> = {};
    if (tableName === '人员表') {
      expectedFields = FEISHU_FIELD_IDS.resources;
    } else if (tableName === '项目表') {
      expectedFields = FEISHU_FIELD_IDS.projects;
    } else if (tableName === '任务表') {
      expectedFields = FEISHU_FIELD_IDS.tasks;
    } else if (tableName === '排期表') {
      expectedFields = FEISHU_FIELD_IDS.schedules;
    }

    // 检查每个预期的字段
    Object.values(expectedFields).forEach(fieldName => {
      const field = existingFieldMap.get(fieldName);

      if (!field) {
        result.missingFields.push(fieldName);
      } else {
        result.validFields.push(fieldName);
      }
    });

    // 检查是否有无效的字段
    existingFields.forEach((field: any) => {
      if (!Object.values(expectedFields).includes(field.field_name)) {
        result.invalidFields.push(field.field_name);
      }
    });

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : '诊断失败');
  }

  return result;
}
