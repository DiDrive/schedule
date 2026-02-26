/**
 * 飞书多维表字段类型解析工具
 *
 * 飞书多维表返回的数据格式：
 * - 文本：直接返回字符串
 * - 数字：直接返回数字
 * - 人员：返回对象数组 [{ id: "user_xxx", name: "xxx", avatar: "xxx" }]
 * - 选项（下拉）：返回对象数组 [{ key: "xxx", text: "xxx", color: "xxx" }]
 * - 日期：返回数字（时间戳，毫秒）或字符串
 * - 多选：返回对象数组
 */

/**
 * 日志函数
 */
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
 * 提取人员字段（从对象数组中提取 ID）
 * @param field 飞书返回的人员字段值
 * @returns 人员 ID 或 ID 数组
 *
 * 示例：
 * 输入: [{ id: "user_123", name: "张三" }]
 * 输出: "user_123"
 *
 * 输入: [{ id: "user_123", name: "张三" }, { id: "user_456", name: "李四" }]
 * 输出: ["user_123", "user_456"]
 */
export function parsePersonField(field: any): string | string[] {
  if (!field) return '';

  // 如果是数组，提取所有 ID
  if (Array.isArray(field)) {
    if (field.length === 0) return '';
    if (field.length === 1) {
      return field[0]?.id || '';
    }
    return field.map((item: any) => item.id).filter(Boolean);
  }

  // 如果是对象，提取 ID
  if (typeof field === 'object' && field.id) {
    return field.id;
  }

  // 如果是字符串，直接返回
  if (typeof field === 'string') {
    return field;
  }

  log(`[字段解析] 无法解析人员字段: ${JSON.stringify(field)}`);
  return '';
}

/**
 * 提取选项字段（从对象数组中提取 key 或 text）
 * @param field 飞书返回的选项字段值
 * @param returnKey 是否返回 key（默认 true），false 则返回 text
 * @returns 选项值或选项值数组
 *
 * 示例：
 * 输入: [{ key: "high", text: "高", color: "red" }]
 * 输出: "high" (returnKey=true) 或 "高" (returnKey=false)
 *
 * 输入: [{ key: "high", text: "高" }, { key: "medium", text: "中" }]
 * 输出: ["high", "medium"] (returnKey=true) 或 ["高", "中"] (returnKey=false)
 */
export function parseOptionField(field: any, returnKey: boolean = true): string | string[] {
  if (!field) return '';

  // 如果是数组，提取所有 key 或 text
  if (Array.isArray(field)) {
    if (field.length === 0) return '';
    if (field.length === 1) {
      return returnKey ? (field[0]?.key || field[0]?.text || '') : (field[0]?.text || field[0]?.key || '');
    }
    return field
      .map((item: any) => returnKey ? item.key : item.text)
      .filter(Boolean);
  }

  // 如果是对象，提取 key 或 text
  if (typeof field === 'object') {
    return returnKey ? (field.key || field.text || '') : (field.text || field.key || '');
  }

  // 如果是字符串，直接返回
  if (typeof field === 'string') {
    return field;
  }

  log(`[字段解析] 无法解析选项字段: ${JSON.stringify(field)}`);
  return '';
}

/**
 * 提取日期字段
 * @param field 飞书返回的日期字段值
 * @returns Date 对象或 null
 *
 * 示例：
 * 输入: 1704067200000 (时间戳)
 * 输出: Date("2024-01-01T00:00:00Z")
 *
 * 输入: "2024-01-01"
 * 输出: Date("2024-01-01T00:00:00Z")
 */
export function parseDateField(field: any): Date | null {
  if (!field) return null;

  // 如果是数字，作为时间戳
  if (typeof field === 'number') {
    const date = new Date(field);
    if (isNaN(date.getTime())) {
      log(`[字段解析] 无效的时间戳: ${field}`);
      return null;
    }
    return date;
  }

  // 如果是字符串，尝试解析
  if (typeof field === 'string') {
    const date = new Date(field);
    if (isNaN(date.getTime())) {
      log(`[字段解析] 无效的日期字符串: ${field}`);
      return null;
    }
    return date;
  }

  log(`[字段解析] 无法解析日期字段: ${JSON.stringify(field)}`);
  return null;
}

/**
 * 提取数字字段
 * @param field 飞书返回的数字字段值
 * @param defaultValue 默认值
 * @returns 数字或默认值
 */
export function parseNumberField(field: any, defaultValue: number = 0): number {
  if (typeof field === 'number') {
    return field;
  }
  if (typeof field === 'string') {
    const num = parseFloat(field);
    return isNaN(num) ? defaultValue : num;
  }
  return defaultValue;
}

/**
 * 提取字符串字段
 * @param field 飞书返回的字符串字段值
 * @param defaultValue 默认值
 * @returns 字符串或默认值
 */
export function parseStringField(field: any, defaultValue: string = ''): string {
  if (typeof field === 'string') {
    return field;
  }
  if (typeof field === 'number') {
    return field.toString();
  }
  if (field && typeof field === 'object') {
    // 尝试提取常见的文本属性
    if (field.name) return field.name;
    if (field.text) return field.text;
    if (field.id) return field.id;
  }
  return defaultValue;
}

/**
 * 提取数组字段
 * @param field 飞书返回的数组字段值
 * @param defaultValue 默认值
 * @returns 数组或默认值
 */
export function parseArrayField(field: any, defaultValue: any[] = []): any[] {
  if (Array.isArray(field)) {
    return field;
  }
  if (field && typeof field === 'object') {
    return [field];
  }
  return defaultValue;
}

/**
 * 调试：打印字段原始值
 * @param fieldName 字段名称
 * @param field 字段值
 */
export function debugField(fieldName: string, field: any): void {
  log(`[字段调试] ${fieldName}: ${JSON.stringify(field)} (类型: ${typeof field})`);
}
