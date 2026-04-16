/**
 * 飞书配置工具函数
 */

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  dataSourceMode: 'legacy' | 'new';
  requirementsLoadMode?: 'all' | 'requirements1' | 'requirements2';
  newMode: {
    appToken: string;
    tableIds: {
      resources: string;
      requirements1: string;
      requirements2: string;
      schedules: string;
    };
    viewIds?: {
      requirements2Matrix?: string;
    };
  };
  legacyMode: {
    appToken: string;
    tableIds: {
      resources: string;
      projects: string;
      tasks: string;
      schedules: string;
    };
  };
  enableAutoSync?: boolean;
  autoSyncInterval?: number;
}

/**
 * 从 localStorage 加载飞书配置
 * 自动处理旧配置格式转换
 */
export function loadFeishuConfig(): FeishuConfig | null {
  const configStr = localStorage.getItem('feishu-config');
  if (!configStr) return null;

  try {
    const config = JSON.parse(configStr);
    return normalizeConfig(config);
  } catch (e) {
    console.error('解析飞书配置失败:', e);
    return null;
  }
}

/**
 * 标准化配置格式（处理旧格式转换）
 */
export function normalizeConfig(config: any): FeishuConfig {
  // 已经是新格式
  if (config.newMode && config.legacyMode) {
    return config;
  }

  // 旧格式转换
  console.log('[Feishu Config] 检测到旧配置格式，自动转换...');
  const oldTableIds = config.tableIds || {};
  const dataSourceMode = config.dataSourceMode || 'new';
  const requirementsLoadMode = config.requirementsLoadMode || 'all';

  const normalized: FeishuConfig = {
    appId: config.appId || '',
    appSecret: config.appSecret || '',
    dataSourceMode: dataSourceMode,
    requirementsLoadMode: requirementsLoadMode,
    newMode: {
      appToken: config.appToken || '',
      tableIds: {
        resources: oldTableIds.resources || '',
        requirements1: oldTableIds.requirements1 || '',
        requirements2: oldTableIds.requirements2 || '',
        schedules: oldTableIds.schedules || '',
      },
    },
    legacyMode: {
      appToken: config.appToken || '',
      tableIds: {
        resources: oldTableIds.resources || '',
        projects: oldTableIds.projects || '',
        tasks: oldTableIds.tasks || '',
        schedules: oldTableIds.schedules || '',
      },
    },
    enableAutoSync: config.enableAutoSync ?? true,
    autoSyncInterval: config.autoSyncInterval ?? 5,
  };

  // 保存转换后的配置
  localStorage.setItem('feishu-config', JSON.stringify(normalized));

  return normalized;
}

/**
 * 获取当前模式的配置
 */
export function getCurrentModeConfig(config: FeishuConfig) {
  if (config.dataSourceMode === 'new') {
    return { mode: 'new' as const, ...config.newMode };
  } else {
    return { mode: 'legacy' as const, ...config.legacyMode };
  };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: FeishuConfig): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!config.appId) missingFields.push('App ID');
  if (!config.appSecret) missingFields.push('App Secret');

  if (config.dataSourceMode === 'new') {
    if (!config.newMode.appToken) {
      missingFields.push('需求表模式 App Token');
    }
    if (!config.newMode.tableIds.resources) {
      missingFields.push('人员表 ID');
    }
    
    const loadMode = config.requirementsLoadMode || 'all';
    if ((loadMode === 'all' || loadMode === 'requirements1') && !config.newMode.tableIds.requirements1) {
      missingFields.push('需求表1 ID');
    }
    if (loadMode === 'requirements2' && !config.newMode.tableIds.requirements2) {
      missingFields.push('需求表2 ID');
    }
  } else {
    if (!config.legacyMode.appToken) {
      missingFields.push('传统模式 App Token');
    }
    if (!config.legacyMode.tableIds.resources) {
      missingFields.push('人员表 ID');
    }
    if (!config.legacyMode.tableIds.projects) {
      missingFields.push('项目表 ID');
    }
    if (!config.legacyMode.tableIds.tasks) {
      missingFields.push('任务表 ID');
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
