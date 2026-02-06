import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书表格任务类型统计 ===\n');
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);

const typeCount = {};
tasksData.forEach(task => {
  typeCount[task.type] = (typeCount[task.type] || 0) + 1;
});

console.log('任务类型分布:');
Object.entries(typeCount).forEach(([type, count]) => {
  console.log(`  ${type}: ${count} 个`);
});

console.log('\n=== 按项目分组统计 ===');
const projectCount = {};
tasksData.forEach(task => {
  const project = task.project || '基础场景';
  projectCount[project] = (projectCount[project] || 0) + 1;
});

console.log('项目任务分布:');
Object.entries(projectCount).forEach(([project, count]) => {
  console.log(`  ${project}: ${count} 个`);
});

console.log('\n=== 依赖关系分析 ===');
const tasksWithDeps = tasksData.filter(t => t.dependencies);
console.log(`有依赖的任务: ${tasksWithDeps.length} 个`);
tasksWithDeps.slice(0, 5).forEach(task => {
  console.log(`  ${task.name} -> ${task.dependencies}`);
});
