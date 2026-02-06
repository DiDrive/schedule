import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书表格排期表数据 ===\n');
const schedulesData = XLSX.utils.sheet_to_json(workbook.Sheets['排期表']);
console.log(JSON.stringify(schedulesData, null, 2));

console.log('\n=== 飞书表格任务表统计 ===\n');
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);
console.log('任务总数:', tasksData.length);

// 计算总工时
const totalEstimatedHours = tasksData.reduce((sum, task) => sum + (task.estimated_hours || 0), 0);
console.log('预估总工时:', totalEstimatedHours);

// 检查有开始/结束时间的任务
const tasksWithTime = tasksData.filter(t => t.start_time && t.end_time);
console.log('有时间的任务数:', tasksWithTime.length);

if (tasksWithTime.length > 0) {
  const startTime = new Date(tasksWithTime[0].start_time);
  const endTime = new Date(tasksWithTime[0].end_time);
  console.log('第一个任务时间:', tasksWithTime[0].start_time, '-', tasksWithTime[0].end_time);
}
