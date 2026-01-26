// 完整测试排期流程（模拟 generateSchedule）

// 默认工作时间配置（从 sample-data.ts 复制）
const defaultWorkingHours = {
  startHour: 9.5, // 9:30
  endHour: 19, // 19:00
  workDays: [1, 2, 3, 4, 5], // 周一到周五
  lunchBreakStart: 12, // 12:00 午休开始
  lunchBreakEnd: 13.5 // 13:30 午休结束
};

function calculateEndDate(startDate, workHours, config = defaultWorkingHours, resourceEfficiency = 1.0) {
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

// 测试1：周一11:35开始的8小时任务
console.log('=== 测试1：周一11:35开始的8小时任务 ===');
const startDate1 = new Date(2025, 0, 27, 11, 35);
const endDate1 = calculateEndDate(startDate1, 8, defaultWorkingHours);
console.log(`开始: ${startDate1.toDateString()} ${startDate1.getHours()}:${String(startDate1.getMinutes()).padStart(2, '0')}`);
console.log(`结束: ${endDate1.toDateString()} ${endDate1.getHours()}:${String(endDate1.getMinutes()).padStart(2, '0')}`);
console.log();

// 测试2：从9:30开始的8小时任务（应该当天完成）
console.log('=== 测试2：周一9:30开始的8小时任务 ===');
const startDate2 = new Date(2025, 0, 27, 9, 30);
const endDate2 = calculateEndDate(startDate2, 8, defaultWorkingHours);
console.log(`开始: ${startDate2.toDateString()} ${startDate2.getHours()}:${String(startDate2.getMinutes()).padStart(2, '0')}`);
console.log(`结束: ${endDate2.toDateString()} ${endDate2.getHours()}:${String(endDate2.getMinutes()).padStart(2, '0')}`);
console.log();

// 测试3：验证工作时间计算
console.log('=== 测试3：验证配置 ===');
console.log(`工作时间: ${defaultWorkingHours.startHour}:30 - ${defaultWorkingHours.endHour}:00`);
console.log(`午休时间: ${defaultWorkingHours.lunchBreakStart}:00 - ${Math.floor(defaultWorkingHours.lunchBreakEnd)}:${String((defaultWorkingHours.lunchBreakEnd % 1) * 60).padStart(2, '0')}`);
console.log(`上午工作时间: ${defaultWorkingHours.lunchBreakStart - defaultWorkingHours.startHour}小时`);
console.log(`下午工作时间: ${defaultWorkingHours.endHour - defaultWorkingHours.lunchBreakEnd}小时`);
console.log(`全天工作时间: ${(defaultWorkingHours.lunchBreakStart - defaultWorkingHours.startHour) + (defaultWorkingHours.endHour - defaultWorkingHours.lunchBreakEnd)}小时`);
