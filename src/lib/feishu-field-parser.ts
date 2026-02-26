/**
 * 飞书多维表字段类型解析工具
 *
 * 飞书多维表返回的数据格式：
 * - 文本：直接返回字符串，或者是 `[{text: "xxx", type: "text"}]` 的数组格式
 * - 数字：直接返回数字
 * - 人员：返回对象数组 `[{ id: "user_xxx", name: "xxx", avatar: "xxx" }]`
 * - 选项（下拉）：返回对象数组 `[{ key: "xxx", text: "xxx", color: "xxx" }]`，或者直接返回字符串
 * - 日期：返回数字（时间戳，毫秒），或者是 `[{text: "2026-02-13T10:30:00.000Z", type: "text"}]` 的数组格式
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
 * 从飞书文本数组格式中提取文本
 * 飞书某些字段返回 `[{text: "xxx", type: "text"}]` 格式
 */
function extractTextFromRichTextArray(field: any): string {
  if (Array.isArray(field) && field.length > 0 && field[0].text) {
    return field[0].text;
  }
  return '';
}

/**
 * 提取人员字段（从对象数组中提取 name）
 * @param field 飞书返回的人员字段值
 * @returns 人员名字或名字数组
 *
 * 示例：
 * 输入: [{ id: "user_123", name: "张三", avatar: "..." }]
 * 输出: "张三"
 *
 * 输入: [{ id: "user_123", name: "张三" }, { id: "user_456", name: "李四" }]
 * 输出: ["张三", "李四"]
 */
export function parsePersonName(field: any): string | string[] {
  if (!field) return '';

  // 如果是数组，提取所有名字
  if (Array.isArray(field)) {
    if (field.length === 0) return '';
    if (field.length === 1) {
      return field[0]?.name || '';
    }
    return field.map((item: any) => item.name).filter(Boolean);
  }

  // 如果是对象，提取名字
  if (typeof field === 'object' && field.name) {
    return field.name;
  }

  // 如果是字符串，直接返回
  if (typeof field === 'string') {
    return field;
  }

  return '';
}

/**
 * 提取人员 ID（从对象数组中提取 id）
 * @param field 飞书返回的人员字段值
 * @returns 人员 ID 或 ID 数组
 *
 * 示例：
 * 输入: [{ id: "user_123", name: "张三" }]
 * 输出: "user_123"
 */
export function parsePersonId(field: any): string | string[] {
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

  return '';
}

/**
 * 提取选项字段（从对象数组中提取 key 或 text，或直接返回字符串）
 * @param field 飞书返回的选项字段值
 * @param returnKey 是否返回 key（默认 true），false 则返回 text
 * @returns 选项值或选项值数组
 *
 * 示例：
 * 输入: [{ key: "high", text: "高", color: "red" }]
 * 输出: "high" (returnKey=true) 或 "高" (returnKey=false)
 *
 * 输入: "高" (直接字符串)
 * 输出: "高"
 *
 * 输入: [{ key: "high", text: "高" }, { key: "medium", text: "中" }]
 * 输出: ["high", "medium"] (returnKey=true) 或 ["高", "中"] (returnKey=false)
 */
export function parseOptionField(field: any, returnKey: boolean = true): string | string[] {
  if (!field) return '';

  // 如果是字符串，直接返回
  if (typeof field === 'string') {
    return field;
  }

  // 如果是数组，提取所有 key 或 text
  if (Array.isArray(field)) {
    if (field.length === 0) return '';
    if (field.length === 1) {
      const item = field[0];
      // 处理两种可能的格式：
      // 1. { key: "xxx", text: "xxx" } - 选项对象
      // 2. { text: "xxx", type: "text" } - 文本数组格式
      if (item.key !== undefined) {
        return returnKey ? (item.key || item.text || '') : (item.text || item.key || '');
      }
      return extractTextFromRichTextArray(field);
    }
    return field
      .map((item: any) => returnKey ? item.key : item.text)
      .filter(Boolean);
  }

  // 如果是对象，提取 key 或 text
  if (typeof field === 'object') {
    return returnKey ? (field.key || field.text || '') : (field.text || field.key || '');
  }

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
 *
 * 输入: [{ text: "2026-02-13T10:30:00.000Z", type: "text" }]
 * 输出: Date("2026-02-13T10:30:00.000Z")
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

  // 如果是数组，尝试提取文本
  if (Array.isArray(field)) {
    const text = extractTextFromRichTextArray(field);
    if (text) {
      const date = new Date(text);
      if (isNaN(date.getTime())) {
        log(`[字段解析] 无法从数组解析日期: ${JSON.stringify(field)}`);
        return null;
      }
      return date;
    }
  }

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
  if (Array.isArray(field) && field.length > 0) {
    // 处理 `[{text: "8", type: "text"}]` 格式
    const text = extractTextFromRichTextArray(field);
    if (text) {
      const num = parseFloat(text);
      return isNaN(num) ? defaultValue : num;
    }
  }
  return defaultValue;
}

/**
 * 提取字符串字段
 * @param field 飞书返回的字符串字段值
 * @param defaultValue 默认值
 * @returns 字符串或默认值
 *
 * 支持：
 * - 直接字符串: "张三"
 * - 文本数组: [{text: "张三", type: "text"}]
 */
export function parseStringField(field: any, defaultValue: string = ''): string {
  if (typeof field === 'string') {
    return field;
  }
  if (typeof field === 'number') {
    return field.toString();
  }
  if (Array.isArray(field)) {
    // 处理 `[{text: "xxx", type: "text"}]` 格式
    const text = extractTextFromRichTextArray(field);
    if (text) return text;
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
 * 提取数组字段（文本数组转字符串数组）
 * @param field 飞书返回的数组字段值
 * @param defaultValue 默认值
 * @returns 数组或默认值
 */
export function parseArrayField(field: any, defaultValue: any[] = []): any[] {
  if (Array.isArray(field)) {
    // 如果是文本数组格式，提取所有文本
    if (field.length > 0 && field[0].text) {
      return field.map((item: any) => item.text).filter(Boolean);
    }
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
  const jsonStr = JSON.stringify(field).substring(0, 300);
  log(`[字段调试] ${fieldName}: ${jsonStr}... (类型: ${typeof field})`);
}
