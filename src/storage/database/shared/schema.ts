import { pgTable, varchar, text, timestamp, boolean, integer, numeric, jsonb, index, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 保留系统表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 资源表（人员）
export const resources = pgTable(
  "resources",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // human, equipment
    work_type: varchar("work_type", { length: 20 }), // 平面, 后期, 脚本, 物料
    level: varchar("level", { length: 20 }), // senior, mid, junior
    capacity: integer("capacity").default(8).notNull(), // 日工作小时
    is_active: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata"), // 扩展字段
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("resources_type_idx").on(table.type),
    index("resources_work_type_idx").on(table.work_type),
  ]
);

// 任务表
export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    estimated_hours: numeric("estimated_hours", { precision: 10, scale: 2 }).default('0'),
    task_type: varchar("task_type", { length: 20 }), // 脚本, 平面, 后期, 物料
    priority: varchar("priority", { length: 20 }).default('normal'), // urgent, high, normal, low
    status: varchar("status", { length: 20 }).default('pending'), // pending, in-progress, to-confirm, completed, overdue, blocked
    
    // 负责人（JSONB 存储多个负责人ID和来源追踪）
    assigned_resources: jsonb("assigned_resources"), // [{resourceId, source, sourceSubTaskId}]
    
    // 日期字段
    deadline: timestamp("deadline", { withTimezone: true }),
    start_date: timestamp("start_date", { withTimezone: true }),
    end_date: timestamp("end_date", { withTimezone: true }),
    actual_end_date: timestamp("actual_end_date", { withTimezone: true }),
    
    // 项目关联
    project_id: varchar("project_id", { length: 36 }),
    project_name: varchar("project_name", { length: 256 }),
    
    // 本地子任务（仅本地可见，不同步到飞书）
    local_sub_tasks: jsonb("local_sub_tasks"), // [{id, name, assignedResourceId, status}]
    
    // 任务扩展信息
    category: varchar("category", { length: 100 }), // 需求类目
    sub_type: varchar("sub_type", { length: 100 }), // 细分类
    language: varchar("language", { length: 50 }), // 语言
    dubbing: varchar("dubbing", { length: 100 }), // 配音
    contact_person: varchar("contact_person", { length: 100 }), // 对接人
    business_month: varchar("business_month", { length: 20 }), // 商务月份
    
    // 飞书关联
    feishu_record_id: varchar("feishu_record_id", { length: 100 }),
    task_source: varchar("task_source", { length: 30 }).default('schedule'),
    source_view_id: varchar("source_view_id", { length: 100 }),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_task_type_idx").on(table.task_type),
    index("tasks_status_idx").on(table.status),
    index("tasks_end_date_idx").on(table.end_date),
    index("tasks_project_id_idx").on(table.project_id),
    index("tasks_task_source_idx").on(table.task_source),
    index("tasks_source_view_id_idx").on(table.source_view_id),
  ]
);

// 日历配置表（调休/加班日等）
export const calendar_config = pgTable(
  "calendar_config",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    config_key: varchar("config_key", { length: 50 }).notNull().unique(), // extra_work_days, holidays 等
    config_value: jsonb("config_value").notNull(), // 存储配置值
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  }
);

// 项目表
export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    priority: varchar("priority", { length: 20 }).default('normal'),
    color: varchar("color", { length: 20 }),
    resource_pool: jsonb("resource_pool").default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 20 }).default('active'),
    start_date: timestamp("start_date", { withTimezone: true }),
    end_date: timestamp("end_date", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
  ]
);

// 排期结果快照表（用于多端共享排期结果）
export const schedule_results = pgTable(
  "schedule_results",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    result: jsonb("result").notNull().default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  }
);

// 类型导出
export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type CalendarConfig = typeof calendar_config.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ScheduleResult = typeof schedule_results.$inferSelect;
