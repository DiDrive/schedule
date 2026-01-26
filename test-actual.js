// 验证用户提供的排期结果
const startDate = new Date(2025, 0, 26, 14, 20); // 1月26日 14:20
const endDate = new Date(2025, 0, 27, 10, 10);   // 1月27日 10:10

console.log('开始时间:', startDate.toDateString(), startDate.getHours() + ':' + String(startDate.getMinutes()).padStart(2, '0'));
console.log('结束时间:', endDate.toDateString(), endDate.getHours() + ':' + String(endDate.getMinutes()).padStart(2, '0'));
console.log();

// 第一天工作：14:20-19:00
const day1Start = startDate;
const day1End = new Date(2025, 0, 26, 19, 0);
const day1Hours = (day1End.getTime() - day1Start.getTime()) / (1000 * 60 * 60);

console.log('第一天（1/26）：');
console.log('  开始: 14:20');
console.log('  结束: 19:00');
console.log('  工时:', day1Hours.toFixed(2), '小时');
console.log();

// 第二天工作：9:30-10:10
const day2Start = new Date(2025, 0, 27, 9, 30);
const day2End = endDate;
const day2Hours = (day2End.getTime() - day2Start.getTime()) / (1000 * 60 * 60);

console.log('第二天（1/27）：');
console.log('  开始: 9:30');
console.log('  结束: 10:10');
console.log('  工时:', day2Hours.toFixed(2), '小时');
console.log();

const totalHours = day1Hours + day2Hours;
console.log('总工时:', totalHours.toFixed(2), '小时');
console.log('预期工时: 8.00 小时');
console.log('差值:', (8 - totalHours).toFixed(2), '小时');
