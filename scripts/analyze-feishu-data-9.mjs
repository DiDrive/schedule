import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (9).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书多维表数据 (9) 分析 ===\n');

console.log('【任务表】');
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);
console.log('任务总数:', tasksData.length);

// 统计有/没有各个字段的任务
const stats = {
  hasName: 0,
  hasStartTime: 0,
  hasEndTime: 0,
  hasDeadline: 0,
  hasAssignee: 0,
  hasEstimatedHours: 0,
};

tasksData.forEach(task => {
  if (task.name) stats.hasName++;
  if (task.start_time) stats.hasStartTime++;
  if (task.end_time) stats.hasEndTime++;
  if (task.deadline) stats.hasDeadline++;
  if (task.assignee) stats.hasAssignee++;
  if (task.estimated_hours) stats.hasEstimatedHours++;
});

console.log('\n字段统计:');
console.log(`  有名称: ${stats.hasName}`);
console.log(`  有预估工时: ${stats.hasEstimatedHours}`);
console.log(`  有截止日期: ${stats.hasDeadline}`);
console.log(`  有开始时间: ${stats.hasStartTime}`);
console.log(`  有结束时间: ${stats.hasEndTime}`);
console.log(`  有负责人: ${stats.hasAssignee}`);

console.log('\n前5条任务:');
tasksData.slice(0, 5).forEach((task, i) => {
  console.log(`\n${i + 1}. ${task.name}`);
  console.log(`   类型: ${task.type}`);
  console.log(`   预估工时: ${task.estimated_hours}`);
  console.log(`   截止日期: ${task.deadline}`);
  console.log(`   开始时间: ${task.start_time}`);
  console.log(`   结束时间: ${task.end_time}`);
  console.log(`   负责人: ${task.assignee}`);
  console.log(`   项目: ${task.project}`);
});

console.log('\n\n【排期表】');
const schedulesData = XLSX.utils.sheet_to_json(workbook.Sheets['排期表']);
console.log('排期记录数:', schedulesData.length);

if (schedulesData.length > 0) {
  console.log('\n排期记录详情:');
  schedulesData.forEach((schedule, i) => {
    console.log(`\n${i + 1}. ${schedule.name}`);
    console.log(`   项目: ${schedule.project}`);
    console.log(`   任务数: ${schedule.task_count}`);
    console.log(`   总工时: ${schedule.total_hours}`);
    console.log(`   利用率: ${schedule.utilization}`);
    console.log(`   关键路径数: ${schedule.critical_path_count}`);
    console.log(`   开始时间: ${schedule.start_time}`);
    console.log(`   结束时间: ${schedule.end_time}`);
    console.log(`   生成时间: ${schedule.generated_at}`);
  });
}
