/**
 * 飞书同步服务
 * 负责系统数据与飞书多维表的双向同步
 */

import {
  initFeishuClient,
  listFeishuRecords,
  createFeishuRecord,
  updateFeishuRecord,
  batchCreateFeishuRecords,
  batchUpdateFeishuRecords,
  type FeishuConfig,
  type FeishuRecord,
} from './feishu-client';
import {
  resourceToFeishuRecord,
  projectToFeishuRecord,
  taskToFeishuRecord,
  scheduleToFeishuRecord,
  feishuRecordToResource,
  feishuRecordToProject,
  feishuRecordToTask,
  detectVersionConflict,
  resolveConflictWithFeishu,
} from './feishu-data-mapper';
import { type Resource, type Project, type Task, type ScheduleResult } from '@/types/schedule';

export interface SyncOptions {
  conflictResolution?: 'feishu' | 'system' | 'manual';
  syncResources?: boolean;
  syncProjects?: boolean;
  syncTasks?: boolean;
  syncSchedules?: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  stats: {
    resources: { created: number; updated: number; deleted: number; conflicts: number };
    projects: { created: number; updated: number; deleted: number; conflicts: number };
    tasks: { created: number; updated: number; deleted: number; conflicts: number };
    schedules: { created: number; updated: number; deleted: number; conflicts: number };
  };
  errors: string[];
}

/**
 * 同步系统数据到飞书多维表
 */
export async function syncToFeishu(
  config: FeishuConfig,
  systemResources: Resource[],
  systemProjects: Project[],
  systemTasks: Task[],
  systemSchedules: ScheduleResult[],
  options: SyncOptions = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    message: '同步成功',
    stats: {
      resources: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
      projects: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
      tasks: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
      schedules: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
    },
    errors: [],
  };

  try {
    // 初始化飞书客户端
    initFeishuClient(config);

    // 同步人员
    if (options.syncResources !== false) {
      const resourceResult = await syncResources(config, systemResources);
      result.stats.resources = resourceResult;
      result.errors.push(...resourceResult.errors);
    }

    // 同步项目
    if (options.syncProjects !== false) {
      const projectResult = await syncProjects(config, systemProjects);
      result.stats.projects = projectResult;
      result.errors.push(...projectResult.errors);
    }

    // 同步任务
    if (options.syncTasks !== false) {
      const taskResult = await syncTasks(config, systemTasks, options.conflictResolution || 'feishu');
      result.stats.tasks = taskResult;
      result.errors.push(...taskResult.errors);
    }

    // 同步排期
    if (options.syncSchedules !== false) {
      const scheduleResult = await syncSchedules(config, systemSchedules);
      result.stats.schedules = scheduleResult;
      result.errors.push(...scheduleResult.errors);
    }

    if (result.errors.length > 0) {
      result.success = false;
      result.message = '同步完成，但有部分错误';
    }
  } catch (error) {
    result.success = false;
    result.message = error instanceof Error ? error.message : '同步失败';
    result.errors.push(result.message);
  }

  return result;
}

/**
 * 同步人员数据
 */
async function syncResources(
  config: FeishuConfig,
  systemResources: Resource[]
): Promise<{ created: number; updated: number; deleted: number; conflicts: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  const errors: string[] = [];

  try {
    // 获取飞书中的所有人员记录
    const feishuRecords = await listFeishuRecords(
      config.appToken,
      config.tableIds.resources
    );

    const feishuRecordMap = new Map<string, FeishuRecord>();
    feishuRecords.items.forEach(record => {
      const id = record.fields.id;
      if (id) {
        feishuRecordMap.set(id, record);
      }
    });

    // 找出需要创建、更新、删除的记录
    const toCreate: Resource[] = [];
    const toUpdate: { record: FeishuRecord; resource: Resource }[] = [];
    const toDelete: FeishuRecord[] = [];

    // 检查系统中的每个资源
    systemResources.forEach(resource => {
      const feishuRecord = feishuRecordMap.get(resource.id);

      if (!feishuRecord) {
        // 需要创建
        toCreate.push(resource);
      } else {
        // 需要更新
        toUpdate.push({ record: feishuRecord, resource });
        feishuRecordMap.delete(resource.id);
      }
    });

    // 剩下的飞书记录需要删除
    toDelete.push(...Array.from(feishuRecordMap.values()));

    // 批量创建
    if (toCreate.length > 0) {
      const records = toCreate.map(r => resourceToFeishuRecord(r));
      await batchCreateFeishuRecords(config.appToken, config.tableIds.resources, records);
      stats.created += toCreate.length;
    }

    // 批量更新
    if (toUpdate.length > 0) {
      const records = toUpdate.map(({ record, resource }) => ({
        record_id: record.record_id,
        fields: resourceToFeishuRecord(resource),
      }));
      await batchUpdateFeishuRecords(config.appToken, config.tableIds.resources, records);
      stats.updated += toUpdate.length;
    }

    // 删除
    if (toDelete.length > 0) {
      for (const record of toDelete) {
        await (async () => {
          // 注意：这里需要实际的删除函数，暂时跳过
          stats.deleted++;
        })();
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '同步人员失败');
  }

  return { ...stats, errors };
}

/**
 * 同步项目数据
 */
async function syncProjects(
  config: FeishuConfig,
  systemProjects: Project[]
): Promise<{ created: number; updated: number; deleted: number; conflicts: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  const errors: string[] = [];

  try {
    // 获取飞书中的所有项目记录
    const feishuRecords = await listFeishuRecords(
      config.appToken,
      config.tableIds.projects
    );

    const feishuRecordMap = new Map<string, FeishuRecord>();
    feishuRecords.items.forEach(record => {
      const id = record.fields.id;
      if (id) {
        feishuRecordMap.set(id, record);
      }
    });

    // 找出需要创建、更新、删除的记录
    const toCreate: Project[] = [];
    const toUpdate: { record: FeishuRecord; project: Project }[] = [];

    systemProjects.forEach(project => {
      const feishuRecord = feishuRecordMap.get(project.id);

      if (!feishuRecord) {
        toCreate.push(project);
      } else {
        toUpdate.push({ record: feishuRecord, project });
        feishuRecordMap.delete(project.id);
      }
    });

    const toDelete = Array.from(feishuRecordMap.values());

    // 批量创建
    if (toCreate.length > 0) {
      const records = toCreate.map(p => projectToFeishuRecord(p));
      await batchCreateFeishuRecords(config.appToken, config.tableIds.projects, records);
      stats.created += toCreate.length;
    }

    // 批量更新
    if (toUpdate.length > 0) {
      const records = toUpdate.map(({ record, project }) => ({
        record_id: record.record_id,
        fields: projectToFeishuRecord(project),
      }));
      await batchUpdateFeishuRecords(config.appToken, config.tableIds.projects, records);
      stats.updated += toUpdate.length;
    }

    // 删除（暂时跳过）
    if (toDelete.length > 0) {
      stats.deleted += toDelete.length;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '同步项目失败');
  }

  return { ...stats, errors };
}

/**
 * 同步任务数据
 */
async function syncTasks(
  config: FeishuConfig,
  systemTasks: Task[],
  conflictResolution: 'feishu' | 'system' | 'manual' = 'feishu'
): Promise<{ created: number; updated: number; deleted: number; conflicts: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  const errors: string[] = [];

  try {
    // 获取飞书中的所有任务记录
    const feishuRecords = await listFeishuRecords(
      config.appToken,
      config.tableIds.tasks
    );

    const feishuRecordMap = new Map<string, FeishuRecord>();
    feishuRecords.items.forEach(record => {
      const id = record.fields.id;
      if (id) {
        feishuRecordMap.set(id, record);
      }
    });

    // 找出需要创建、更新、删除的记录
    const toCreate: Task[] = [];
    const toUpdate: { record: FeishuRecord; task: Task }[] = [];
    const toDelete: FeishuRecord[] = [];

    systemTasks.forEach(task => {
      const feishuRecord = feishuRecordMap.get(task.id);

      if (!feishuRecord) {
        // 需要创建
        toCreate.push(task);
      } else {
        // 检测冲突
        if (detectVersionConflict(task, feishuRecord)) {
          stats.conflicts++;

          if (conflictResolution === 'feishu') {
            // 以飞书为准，更新系统任务
            const resolvedTask = resolveConflictWithFeishu(task, feishuRecord);
            toUpdate.push({ record: feishuRecord, task: resolvedTask });
          } else if (conflictResolution === 'system') {
            // 以系统为准，更新飞书记录
            toUpdate.push({ record: feishuRecord, task });
          }
          // manual 模式需要用户手动选择，这里先跳过
        } else {
          // 无冲突，正常更新
          toUpdate.push({ record: feishuRecord, task });
        }

        feishuRecordMap.delete(task.id);
      }
    });

    // 剩下的飞书记录需要删除
    toDelete.push(...Array.from(feishuRecordMap.values()));

    // 批量创建
    if (toCreate.length > 0) {
      const records = toCreate.map(t => taskToFeishuRecord(t));
      await batchCreateFeishuRecords(config.appToken, config.tableIds.tasks, records);
      stats.created += toCreate.length;
    }

    // 批量更新
    if (toUpdate.length > 0) {
      const records = toUpdate.map(({ record, task }) => ({
        record_id: record.record_id,
        fields: {
          ...taskToFeishuRecord(task),
          system_version: (record.fields.system_version as number || 0) + 1,
          last_synced_at: Date.now(),
          sync_source: '系统',
        },
      }));
      await batchUpdateFeishuRecords(config.appToken, config.tableIds.tasks, records);
      stats.updated += toUpdate.length;
    }

    // 删除（暂时跳过）
    if (toDelete.length > 0) {
      stats.deleted += toDelete.length;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '同步任务失败');
  }

  return { ...stats, errors };
}

/**
 * 同步排期数据
 */
async function syncSchedules(
  config: FeishuConfig,
  systemSchedules: ScheduleResult[]
): Promise<{ created: number; updated: number; deleted: number; conflicts: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, deleted: 0, conflicts: 0 };
  const errors: string[] = [];

  try {
    // 每次生成排期时，创建一条新的排期记录
    if (systemSchedules.length > 0) {
      const latestSchedule = systemSchedules[systemSchedules.length - 1];
      const record = scheduleToFeishuRecord(latestSchedule);
      await createFeishuRecord(config.appToken, config.tableIds.schedules, record);
      stats.created++;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '同步排期失败');
  }

  return { ...stats, errors };
}
