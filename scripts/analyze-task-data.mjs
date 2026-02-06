import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

const workbook = XLSX.readFile(filePath);
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);

console.log('=== 飞书表格任务表分析 ===\n');
console.log('任务总数:', tasksData.length);
console.log('\n有开始时间的任务:', tasksData.filter(t => t.start_time).length);
console.log('有结束时间的任务:', tasksData.filter(t => t.end_time).length);
console.log('有负责人的任务:', tasksData.filter(t => t.assignee).length);

console.log('\n=== 前3个任务的详细信息 ===');
tasksData.slice(0, 3).forEach((task, index) => {
  console.log(`\n任务 ${index + 1}:`);
  console.log(`  ID: ${task.id}`);
  console.log(`  名称: ${task.name}`);
  console.log(`  项目: ${task.project}`);
  console.log(`  类型: ${task.type}`);
  console.log(`  预估工时: ${task.estimated_hours}`);
  console.log(`  开始时间: ${task.start_time}`);
  console.log(`  结束时间: ${task.end_time}`);
  console.log(`  截止日期: ${task.deadline}`);
  console.log(`  负责人: ${task.assignee}`);
  console.log(`  依赖: ${task.dependencies}`);
  console.log(`  状态: ${task.status}`);
});

console.log('\n=== 排期表数据 ===');
const schedulesData = XLSX.utils.sheet_to_json(workbook.Sheets['排期表']);
schedulesData.forEach((schedule, index) => {
  console.log(`\n排期 ${index + 1}:`);
  console.log(`  名称: ${schedule.name}`);
  console.log(`  项目: ${schedule.project}`);
  console.log(`  任务数: ${schedule.task_count}`);
  console.log(`  总工时: ${schedule.total_hours}`);
  console.log(`  利用率: ${schedule.utilization}`);
  console.log(`  开始时间: ${schedule.start_time}`);
  console.log(`  结束时间: ${schedule.end_time}`);
  console.log(`  生成时间: ${schedule.generated_at}`);
});
