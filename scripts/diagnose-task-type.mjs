import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书表格任务类型分析 ===\n');
const tasksData = XLSX.utils.sheet_to_json(workbook.Sheets['任务表']);

// 按类型统计
const typeStats = {};
tasksData.forEach(task => {
  const type = task.type || '未分类';
  if (!typeStats[type]) {
    typeStats[type] = { count: 0, tasks: [] };
  }
  typeStats[type].count++;
  typeStats[type].tasks.push(task.name);
});

Object.entries(typeStats).forEach(([type, info]) => {
  console.log(`\n【${type}】共 ${info.count} 个任务`);
  console.log(`  任务列表: ${info.tasks.slice(0, 5).join(', ')}${info.tasks.length > 5 ? '...' : ''}`);
});

// 检查是否有平面和后期任务
const hasGraphic = tasksData.some(t => t.type === '平面设计');
const hasPost = tasksData.some(t => t.type === '后期制作');
const hasMaterial = tasksData.some(t => t.type === '物料');

console.log('\n=== 问题诊断 ===');
console.log(`有"平面设计"任务: ${hasGraphic ? '是' : '否'}`);
console.log(`有"后期制作"任务: ${hasPost ? '是' : '否'}`);
console.log(`有"物料"任务: ${hasMaterial ? '是' : '否'}`);

console.log('\n=== 建议 ===');
if (!hasGraphic && !hasPost) {
  console.log('⚠ 系统中的任务可能缺少 workType 字段！');
  console.log('⚠ 请在系统中为任务设置正确的工作类型（平面/后期/物料）');
  console.log('⚠ 物料任务应该使用"物料"类型，不分配人员');
  console.log('⚠ 平面任务应该使用"平面设计"类型，分配平面人员');
  console.log('⚠ 后期任务应该使用"后期制作"类型，分配后期人员');
}
