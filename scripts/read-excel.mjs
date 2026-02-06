import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'assets/飞书多维表数据 (3).xlsx');

if (!fs.existsSync(filePath)) {
  console.error('文件不存在:', filePath);
  process.exit(1);
}

const workbook = XLSX.readFile(filePath);

console.log('=== 飞书多维表数据结构 ===\n');

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n【工作表: ${sheetName}】`);
  console.log('----------------------------------------');
  
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  if (data.length === 0) {
    console.log('空表');
    return;
  }
  
  console.log(`数据行数: ${data.length}`);
  console.log(`列名: ${Object.keys(data[0]).join(', ')}`);
  console.log('\n前 2 条数据:');
  console.log(JSON.stringify(data.slice(0, 2), null, 2));
  console.log('----------------------------------------');
});
