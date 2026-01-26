// 测试修复后的算法（不使用效率系数）

const defaultWorkingHours = {
  startHour: 9.5,
  endHour: 19,
  workDays: [0, 1, 2, 3, 4, 5, 6],
  lunchBreakStart: 12,
  lunchBreakEnd: 13.5
};

function calculateEndDate(startDate, workHours, config = defaultWorkingHours) {
  const result = new Date(startDate);
  let remainingHours = workHours;

  const getLunchBreak = (date) => {
    if (config.lunchBreakStart !== undefined && config.lunchBreakEnd !== undefined) {
      const lunchStart = new Date(date);
      lunchStart.setHours(Math.floor(config.lunchBreakStart), (config.lunchBreakStart % 1) * 60, 0, 0);
      const lunchEnd = new Date(date);
      lunchEnd.setHours(Math.floor(config.lunchBreakEnd), (config.lunchBreakEnd % 1) * 60, 0, 0);
      return { start: lunchStart, end: lunchEnd };
    }
    return null;
  };

  while (remainingHours > 0) {
    const dayOfWeek = result.getDay();

    if (!config.workDays.includes(dayOfWeek)) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    const startOfDay = new Date(result);
    startOfDay.setHours(Math.floor(config.startHour), (config.startHour % 1) * 60, 0, 0);
    const endOfDay = new Date(result);
    endOfDay.setHours(Math.floor(config.endHour), (config.endHour % 1) * 60, 0, 0);
    const lunchBreak = getLunchBreak(result);

    if (result < startOfDay) {
      result.setTime(startOfDay.getTime());
      continue;
    }
    if (result >= endOfDay) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }
    if (lunchBreak && result >= lunchBreak.start && result < lunchBreak.end) {
      result.setTime(lunchBreak.end.getTime());
      continue;
    }

    let availableHours;
    if (lunchBreak && lunchBreak.start < lunchBreak.end) {
      if (result < lunchBreak.start) {
        availableHours = (lunchBreak.start.getTime() - result.getTime()) / (1000 * 60 * 60);
      } else {
        availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
      }
    } else {
      availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
    }

    const hoursToUse = Math.min(remainingHours, availableHours);
    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    if (remainingHours > 0) {
      if (lunchBreak && lunchBreak.start < lunchBreak.end &&
          result.getTime() === lunchBreak.start.getTime()) {
        result.setTime(lunchBreak.end.getTime());
      } else if (result.getTime() >= endOfDay.getTime()) {
        result.setDate(result.getDate() + 1);
        result.setHours(0, 0, 0, 0);
      }
    }
  }

  return result;
}

// 测试：1月26日 14:20 开始，8小时任务（不考虑效率）
const startDate = new Date(2025, 0, 26, 14, 20);
const workHours = 8;

console.log('=================================');
console.log(`开始: ${startDate.toDateString()} ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`);
console.log(`需要: ${workHours} 小时（不考虑效率）`);
console.log('=================================');

const endDate = calculateEndDate(startDate, workHours);

console.log('\n=================================');
console.log(`结束: ${endDate.toDateString()} ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`);
console.log();

// 验证实际工作时间
const day1Hours = (new Date(2025, 0, 26, 19, 0).getTime() - startDate.getTime()) / (1000 * 60 * 60);
const day2Start = new Date(2025, 0, 27, 9, 30);
const day2End = new Date(endDate);
const day2Hours = (day2End.getTime() - day2Start.getTime()) / (1000 * 60 * 60);

console.log('实际工作时间：');
console.log(`  第一天：${day1Hours.toFixed(2)} 小时 (14:20-19:00)`);
console.log(`  第二天：${day2Hours.toFixed(2)} 小时 (9:30-${day2End.getHours()}:${String(day2End.getMinutes()).padStart(2, '0')})`);
console.log(`  总计：${(day1Hours + day2Hours).toFixed(2)} 小时`);
