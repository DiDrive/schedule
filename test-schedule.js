// 测试排期算法

// 默认工作时间配置
const DEFAULT_WORKING_HOURS = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5], // 周一到周五
  lunchBreakStart: 12, // 12:00
  lunchBreakEnd: 13.5 // 13:30
};

function calculateEndDate(startDate, workHours, config = DEFAULT_WORKING_HOURS, resourceEfficiency = 1.0) {
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

  let iteration = 0;
  while (remainingHours > 0) {
    iteration++;
    if (iteration > 100) {
      console.error('防止死循环');
      break;
    }

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

    // 如果当前时间在工作日之前，从工作日开始
    if (result < startOfDay) {
      result.setTime(startOfDay.getTime());
      continue;
    }

    // 如果当前时间在工作日之后，跳到下一个工作日
    if (result >= endOfDay) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    // 检查是否在午休时间
    if (lunchBreak && result >= lunchBreak.start && result < lunchBreak.end) {
      result.setTime(lunchBreak.end.getTime());
      continue;
    }

    // 计算当天剩余工作时间（考虑午休）
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

    console.log(`迭代 ${iteration}: current=${result.toISOString()}, remainingHours=${remainingHours.toFixed(2)}, availableHours=${availableHours.toFixed(2)}`);

    const hoursToUse = Math.min(remainingHours, availableHours);

    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    console.log(`  使用了 ${hoursToUse.toFixed(2)} 小时, 新时间=${result.toISOString()}, 剩余=${remainingHours.toFixed(2)}`);

    if (remainingHours > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }

  return result;
}

// 测试案例
const startDate = new Date('2025-01-26T11:35:00');
const workHours = 8;

console.log(`开始时间: ${startDate.toISOString()}`);
console.log(`需要工作小时数: ${workHours}`);
console.log('');

const endDate = calculateEndDate(startDate, workHours);
console.log('');
console.log(`结束时间: ${endDate.toISOString()}`);
console.log(`日期: ${endDate.toLocaleDateString()} ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`);
