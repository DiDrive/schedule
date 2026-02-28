/**
 * 技能和擅长配置模块
 * 提供默认的技能和擅长列表，并支持从 LocalStorage 加载用户自定义配置
 */

import { Skill, Specialty } from '@/types/schedule';

// ==================== 默认技能列表 ====================

export const DEFAULT_SKILLS: Skill[] = [
  // 平面技能
  {
    id: 'graphic-design',
    name: '平面设计',
    category: 'graphic',
    description: '海报、Banner、KV 等平面视觉设计'
  },
  {
    id: 'illustration',
    name: '插画绘制',
    category: 'graphic',
    description: '手绘插画、矢量插画等'
  },
  {
    id: 'ui-design',
    name: 'UI设计',
    category: 'graphic',
    description: '用户界面、交互设计'
  },
  {
    id: 'brand-design',
    name: '品牌设计',
    category: 'graphic',
    description: 'Logo、VI、品牌视觉系统'
  },

  // 后期技能
  {
    id: 'video-editing',
    name: '视频剪辑',
    category: 'post',
    description: 'Premiere、Final Cut 等剪辑工具'
  },
  {
    id: 'color-grading',
    name: '调色',
    category: 'post',
    description: 'DaVinci Resolve 调色'
  },
  {
    id: 'vfx',
    name: '特效制作',
    category: 'post',
    description: 'After Effects、C4D 特效'
  },
  {
    id: 'audio-mix',
    name: '音频混音',
    category: 'post',
    description: '配音配乐、音频处理'
  },
  {
    id: 'motion-graphics',
    name: '动态图形',
    category: 'post',
    description: 'MG 动画制作'
  },

  // 通用技能
  {
    id: 'project-management',
    name: '项目管理',
    category: 'common',
    description: '项目规划、进度管理'
  },
  {
    id: 'storyboard',
    name: '分镜设计',
    category: 'common',
    description: '脚本策划、分镜绘制'
  },
  {
    id: 'photography',
    name: '摄影',
    category: 'common',
    description: '摄像、摄影'
  },
  {
    id: 'lighting',
    name: '灯光',
    category: 'common',
    description: '布光、灯光控制'
  }
];

// ==================== 默认擅长列表 ====================

export const DEFAULT_SPECIALTIES: Specialty[] = [
  {
    id: 'short-video',
    name: '短视频',
    category: '内容类型',
    description: '抖音、快手等短视频平台内容'
  },
  {
    id: 'promo-video',
    name: '宣传片',
    category: '内容类型',
    description: '企业宣传片、产品宣传片'
  },
  {
    id: 'advertising',
    name: '广告片',
    category: '内容类型',
    description: '电视广告、网络广告'
  },
  {
    id: 'social-media',
    name: '社交媒体',
    category: '内容类型',
    description: '微博、小红书、朋友圈等社媒内容'
  },
  {
    id: 'live-stream',
    name: '直播',
    category: '内容类型',
    description: '直播活动、直播带货'
  },
  {
    id: 'e-commerce',
    name: '电商',
    category: '行业',
    description: '电商产品拍摄、详情页设计'
  },
  {
    id: 'education',
    name: '教育',
    category: '行业',
    description: '在线教育、课程视频'
  },
  {
    id: 'fashion',
    name: '时尚',
    category: '行业',
    description: '时尚大片、服装拍摄'
  },
  {
    id: 'food',
    name: '美食',
    category: '行业',
    description: '美食拍摄、餐饮推广'
  },
  {
    id: 'real-estate',
    name: '房地产',
    category: '行业',
    description: '地产宣传、样板房拍摄'
  },
  {
    id: 'automotive',
    name: '汽车',
    category: '行业',
    description: '汽车广告、车评视频'
  },
  {
    id: 'tech',
    name: '科技',
    category: '行业',
    description: '科技产品、软件推广'
  }
];

// ==================== LocalStorage 键 ====================

export const STORAGE_KEYS = {
  CUSTOM_SKILLS: 'custom-skills',
  CUSTOM_SPECIALTIES: 'custom-specialties',
};

// ==================== 工具函数 ====================

/**
 * 获取技能列表（默认 + 自定义）
 */
export function getSkills(): Skill[] {
  try {
    const customSkills = JSON.parse(
      typeof window !== 'undefined' 
        ? localStorage.getItem(STORAGE_KEYS.CUSTOM_SKILLS) || '[]' 
        : '[]'
    );
    return [...DEFAULT_SKILLS, ...customSkills];
  } catch (error) {
    console.error('加载自定义技能失败:', error);
    return DEFAULT_SKILLS;
  }
}

/**
 * 获取擅长列表（默认 + 自定义）
 */
export function getSpecialties(): Specialty[] {
  try {
    const customSpecialties = JSON.parse(
      typeof window !== 'undefined' 
        ? localStorage.getItem(STORAGE_KEYS.CUSTOM_SPECIALTIES) || '[]' 
        : '[]'
    );
    return [...DEFAULT_SPECIALTIES, ...customSpecialties];
  } catch (error) {
    console.error('加载自定义擅长失败:', error);
    return DEFAULT_SPECIALTIES;
  }
}

/**
 * 根据技能ID获取技能信息
 */
export function getSkillById(skillId: string): Skill | undefined {
  const allSkills = getSkills();
  return allSkills.find(skill => skill.id === skillId);
}

/**
 * 根据擅长ID获取擅长信息
 */
export function getSpecialtyById(specialtyId: string): Specialty | undefined {
  const allSpecialties = getSpecialties();
  return allSpecialties.find(specialty => specialty.id === specialtyId);
}

/**
 * 根据任务类型推断默认技能
 */
export function inferDefaultSkills(taskType: string): string[] {
  const skillMap: Record<string, string[]> = {
    '平面': ['graphic-design'],
    '后期': ['video-editing', 'color-grading'],
    '物料': [],
  };
  return skillMap[taskType] || [];
}

/**
 * 根据任务名称推断擅长领域
 */
export function inferSpecialtiesFromName(taskName: string): string[] {
  if (!taskName) return [];

  const keywordToSpecialty: Record<string, string> = {
    '短视频': 'short-video',
    '抖音': 'short-video',
    '快手': 'short-video',
    '宣传片': 'promo-video',
    '企业': 'promo-video',
    '产品': 'promo-video',
    '广告': 'advertising',
    '电视': 'advertising',
    '社交': 'social-media',
    '微博': 'social-media',
    '小红书': 'social-media',
    '朋友圈': 'social-media',
    '直播': 'live-stream',
    '带货': 'live-stream',
    '电商': 'e-commerce',
    '淘宝': 'e-commerce',
    '京东': 'e-commerce',
    '教育': 'education',
    '课程': 'education',
    '时尚': 'fashion',
    '服装': 'fashion',
    '美食': 'food',
    '餐饮': 'food',
    '地产': 'real-estate',
    '房地产': 'real-estate',
    '样板房': 'real-estate',
    '汽车': 'automotive',
    '车': 'automotive',
    '科技': 'tech',
    '软件': 'tech',
    'APP': 'tech',
  };

  const matchedSpecialties: string[] = [];
  for (const [keyword, specialtyId] of Object.entries(keywordToSpecialty)) {
    if (taskName.includes(keyword)) {
      matchedSpecialties.push(specialtyId);
    }
  }

  // 去重
  return Array.from(new Set(matchedSpecialties));
}

/**
 * 保存自定义技能
 */
export function saveCustomSkills(customSkills: Skill[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SKILLS, JSON.stringify(customSkills));
  }
}

/**
 * 保存自定义擅长
 */
export function saveCustomSpecialties(customSpecialties: Specialty[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SPECIALTIES, JSON.stringify(customSpecialties));
  }
}

/**
 * 清除自定义技能和擅长（恢复默认）
 */
export function clearCustomConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SKILLS);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_SPECIALTIES);
  }
}
