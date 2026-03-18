/**
 * 细分类选项
 */
export const SUB_TYPE_OPTIONS = [
  '简中新片',
  '繁中新片',
  '日语新片',
  '英语新片',
  '简改繁',
  '简改日',
  '简改韩',
  '简改英',
  '简改泰',
  '简改越南',
  '繁改日',
  '繁改英',
  '英改简',
  '英改繁',
  '英改日',
  '英改韩',
  '英改德',
  '英改法',
  '英改西',
  '英改葡',
  '日改韩',
  '日改英',
  'AI混剪',
  '繁改简',
  '繁改韩',
  '繁改泰',
  '日改简',
  '日改繁',
  '翻译需求-英文',
  '翻译需求-韩文',
  '配音需求-英语',
  '配音需求-韩语',
  '翻译需求-日文',
  '英语延展',
  '繁中延展',
  '韩语延展',
  '日语延展',
  '简中平面',
  'NOVA-买量需求',
  '05-富婆人生（春节跳舞福利）',
] as const;

export type SubType = typeof SUB_TYPE_OPTIONS[number];

/**
 * 语言选项
 */
export const LANGUAGE_OPTIONS = [
  '简中',
  '英语',
  '德语',
  '法语',
  '繁中',
  '越南语',
  '日语',
  '韩语',
  '印尼语',
  '泰语',
  '西语',
  '葡语',
] as const;

export type Language = typeof LANGUAGE_OPTIONS[number];

/**
 * 根据细分类推断任务类型
 */
export function inferTaskTypeFromSubType(subType: string): '平面' | '后期' | '物料' | undefined {
  if (!subType) return undefined;
  
  // 平面类
  const graphicKeywords = ['平面', 'kv', 'KV', '海报', 'banner', 'Banner'];
  if (graphicKeywords.some(k => subType.includes(k))) {
    return '平面';
  }
  
  // 物料类
  const materialKeywords = ['物料', '素材'];
  if (materialKeywords.some(k => subType.includes(k))) {
    return '物料';
  }
  
  // 其他默认为后期
  return '后期';
}
