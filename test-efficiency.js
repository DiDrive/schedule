// 测试效率系数的影响

function calculateEndDate(startDate, workHours, efficiency = 1.0) {
  const adjustedHours = workHours / efficiency;

  console.log(`预估工时: ${workHours}小时`);
  console.log(`资源效率: ${efficiency}`);
  console.log(`调整后工时: ${adjustedHours.toFixed(2)}小时 = ${workHours} / ${efficiency}`);
  console.log();

  return adjustedHours;
}

// 测试不同等级的效率
console.log('=== 助手 (效率: 0.7) ===');
calculateEndDate(new Date(), 8, 0.7);

console.log('=== 初级 (效率: 1.0) ===');
calculateEndDate(new Date(), 8, 1.0);

console.log('=== 高级 (效率: 1.5) ===');
const adjusted = calculateEndDate(new Date(), 8, 1.5);

console.log('\n验证:');
console.log(`如果高级资源工作 ${adjusted.toFixed(2)} 小时，实际产出: ${adjusted.toFixed(2)} * 1.5 = ${(adjusted * 1.5).toFixed(2)} 小时`);

// 使用完整算法测试
const defaultWorkingHours = {
  startHour: 9.5,
  endHour: 19,
  workDays: [0, 1, 2, 3, 4, 5, 6],
  lunchBreakStart: 12,
  lunchBreakEnd: 13.5
};

function fullCalculateEndDate(startDate, workHours, config = defaultWorkingHours, resourceEfficiency = 1.0) {
  const adjustedHours = workHours / resourceEfficiency;
  const result = new Date(startDate);
  let remainingHours = adjustedHours;

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

console.log('\n=== 完整测试：高级资源，8小时任务 ===');
const startDate = new Date(2025, 0, 26, 14, 20);
const endDate = fullCalculateEndDate(startDate, 8, defaultWorkingHours, 1.5);
console.log(`开始: ${startDate.toDateString()} ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`);
console.log(`结束: ${endDate.toDateString()} ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`);
