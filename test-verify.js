// 验证修复后的计算结果

const startDate = new Date(2025, 0, 26, 14, 20);
const endDate = new Date(2025, 0, 27, 14, 20);

console.log('开始时间:', startDate.toDateString(), startDate.getHours() + ':' + String(startDate.getMinutes()).padStart(2, '0'));
console.log('结束时间:', endDate.toDateString(), endDate.getHours() + ':' + String(endDate.getMinutes()).padStart(2, '0'));
console.log();

// 第一天（1/26）: 14:20-19:00
const day1End = new Date(2025, 0, 26, 19, 0);
const day1Hours = (day1End.getTime() - startDate.getTime()) / (1000 * 60 * 60);
console.log('第一天（1/26）：');
console.log('  开始: 14:20');
console.log('  结束: 19:00');
console.log('  工时:', day1Hours.toFixed(2), '小时');
console.log();

// 第二天（1/27）: 9:30-12:00 + 13:30-14:20
const day2MorningStart = new Date(2025, 0, 27, 9, 30);
const day2MorningEnd = new Date(2025, 0, 27, 12, 0);
const day2MorningHours = (day2MorningEnd.getTime() - day2MorningStart.getTime()) / (1000 * 60 * 60);

const day2AfternoonStart = new Date(2025, 0, 27, 13, 30);
const day2AfternoonEnd = endDate;
const day2AfternoonHours = (day2AfternoonEnd.getTime() - day2AfternoonStart.getTime()) / (1000 * 60 * 60);

const day2TotalHours = day2MorningHours + day2AfternoonHours;

console.log('第二天（1/27）：');
console.log('  上午: 9:30-12:00 =', day2MorningHours.toFixed(2), '小时');
console.log('  午休: 12:00-13:30 (跳过)');
console.log('  下午: 13:30-14:20 =', day2AfternoonHours.toFixed(2), '小时');
console.log('  工时: 合计 =', day2TotalHours.toFixed(2), '小时');
console.log();

const totalHours = day1Hours + day2TotalHours;
console.log('总工时:', totalHours.toFixed(2), '小时');
console.log('预期工时: 8.00 小时');
console.log('是否匹配:', Math.abs(totalHours - 8.0) < 0.01 ? '✓' : '✗');
