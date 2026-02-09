import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (7).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书多维表数据 (7) 分析 ===\n');

console.log('【人员表】');
const resourcesData = XLSX.utils.sheet_to_json(workbook.Sheets['人员表']);
console.log('数量:', resourcesData.length);
console.log('前2条:', JSON.stringify(resourcesData.slice(0, 2), null, 2));

console.log('\n【项目表】');
const projectsData = XLSX.utils.sheet_to_json(workbook.Sheets['项目表']);
console.log('数量:', projectsData.length);
console.log('前2条:', JSON.stringify(projectsData.slice(0, 2), null, 2));

console.log('\n【任务表】');
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);
console.log('数量:', tasksData.length);
const tasksWithTime = tasksData.filter(t => t.start_time && t.end_time);
console.log('有时间的任务:', tasksWithTime.length);
console.log('前3条:', JSON.stringify(tasksData.slice(0, 3), null, 2));

console.log('\n【排期表】');
const schedulesData = XLSX.utils.sheet_to_json(workbook.Sheets['排期表']);
console.log('数量:', schedulesData.length);
console.log(JSON.stringify(schedulesData, null, 2));

console.log('\n=== 问题诊断 ===');
console.log('排期表任务总数:', schedulesData.reduce((sum, s) => sum + (s.task_count || 0), 0));
console.log('任务表任务总数:', tasksData.length);
console.log('排期表和任务表是否一致:', schedulesData.reduce((sum, s) => sum + (s.task_count || 0), 0) === tasksData.length);

if (schedulesData.length > 0) {
  const schedule = schedulesData[0];
  console.log('\n排期表详细信息:');
  console.log('  名称:', schedule.name);
  console.log('  任务数:', schedule.task_count);
  console.log('  总工时:', schedule.total_hours);
  console.log('  利用率:', schedule.utilization);
  console.log('  关键路径数:', schedule.critical_path_count);
  console.log('  开始时间:', schedule.start_time);
  console.log('  结束时间:', schedule.end_time);
  console.log('  生成时间:', schedule.generated_at);
}
