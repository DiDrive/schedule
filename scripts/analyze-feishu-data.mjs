import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书表格中的任务表（前5条）===\n');
const tasksSheet = workbook.Sheets['任务表'];
const tasksData = XLSX.utils.sheet_to_json(tasksSheet);
console.log(JSON.stringify(tasksData.slice(0, 5), null, 2));

console.log('\n\n=== 飞书表格中的排期表 ===\n');
const schedulesSheet = workbook.Sheets['排期表'];
const schedulesData = XLSX.utils.sheet_to_json(schedulesSheet);
console.log(JSON.stringify(schedulesData, null, 2));

console.log('\n\n=== 飞书表格中的项目表 ===\n');
const projectsSheet = workbook.Sheets['项目表'];
const projectsData = XLSX.utils.sheet_to_json(projectsSheet);
console.log(JSON.stringify(projectsData, null, 2));
