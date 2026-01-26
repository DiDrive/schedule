// 模拟用户实际案例：1月26日 14:20 开始，8小时任务
const defaultWorkingHours = {
  startHour: 9.5,
  endHour: 19,
  workDays: [0, 1, 2, 3, 4, 5, 6], // 测试时包含所有日期
  lunchBreakStart: 12,
  lunchBreakEnd: 13.5
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
    const timeStr = `${result.getHours()}:${String(result.getMinutes()).padStart(2, '0')}`;

    console.log(`\n=== 迭代 ${iteration} ===`);
    console.log(`当前时间: ${result.toDateString()} ${timeStr} (周${dayOfWeek})`);
    console.log(`剩余工时: ${remainingHours.toFixed(2)}小时`);

    if (!config.workDays.includes(dayOfWeek)) {
      console.log(`  -> 非工作日，跳到下一天`);
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    const startOfDay = new Date(result);
    startOfDay.setHours(Math.floor(config.startHour), (config.startHour % 1) * 60, 0, 0);

    const endOfDay = new Date(result);
    endOfDay.setHours(Math.floor(config.endHour), (config.endHour % 1) * 60, 0, 0);

    const lunchBreak = getLunchBreak(result);

    console.log(`  工作时间: ${startOfDay.getHours()}:${String(startOfDay.getMinutes()).padStart(2, '0')} - ${endOfDay.getHours()}:${String(endOfDay.getMinutes()).padStart(2, '0')}`);
    if (lunchBreak) {
      console.log(`  午休时间: ${lunchBreak.start.getHours()}:${String(lunchBreak.start.getMinutes()).padStart(2, '0')} - ${lunchBreak.end.getHours()}:${String(lunchBreak.end.getMinutes()).padStart(2, '0')}`);
    }

    if (result < startOfDay) {
      console.log(`  -> 工作时间未开始，调整到工作日`);
      result.setTime(startOfDay.getTime());
      continue;
    }

    if (result >= endOfDay) {
      console.log(`  -> 已过工作时间，跳到下一天`);
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
      continue;
    }

    if (lunchBreak && result >= lunchBreak.start && result < lunchBreak.end) {
      console.log(`  -> 在午休时间，跳到午休结束`);
      result.setTime(lunchBreak.end.getTime());
      continue;
    }

    let availableHours;

    if (lunchBreak && lunchBreak.start < lunchBreak.end) {
      if (result < lunchBreak.start) {
        availableHours = (lunchBreak.start.getTime() - result.getTime()) / (1000 * 60 * 60);
        console.log(`  -> 在午休前，可用: ${availableHours.toFixed(2)}小时`);
      } else {
        availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
        console.log(`  -> 在午休后，可用: ${availableHours.toFixed(2)}小时`);
      }
    } else {
      availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
      console.log(`  -> 无午休，可用: ${availableHours.toFixed(2)}小时`);
    }

    const hoursToUse = Math.min(remainingHours, availableHours);
    console.log(`  -> 使用: ${hoursToUse.toFixed(2)}小时`);

    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    console.log(`  -> 新时间: ${result.getHours()}:${String(result.getMinutes()).padStart(2, '0')}, 剩余: ${remainingHours.toFixed(2)}小时`);

    if (remainingHours > 0) {
      if (lunchBreak && lunchBreak.start < lunchBreak.end &&
          result.getTime() === lunchBreak.start.getTime()) {
        console.log(`  -> 到达午休开始，跳到午休结束`);
        result.setTime(lunchBreak.end.getTime());
      } else if (result.getTime() >= endOfDay.getTime()) {
        console.log(`  -> 已到下班，跳到下一天 0:00`);
        result.setDate(result.getDate() + 1);
        result.setHours(0, 0, 0, 0);
      } else {
        console.log(`  -> 继续同一天`);
      }
    } else {
      console.log(`  -> 完成！`);
    }
  }

  return result;
}

// 测试：1月26日 14:20 开始，8小时任务
const startDate = new Date(2025, 0, 26, 14, 20);
const workHours = 8;

console.log('=================================');
console.log(`开始: ${startDate.toDateString()} ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`);
console.log(`需要: ${workHours} 小时`);
console.log('=================================');

const endDate = calculateEndDate(startDate, workHours);

console.log('\n=================================');
console.log(`结束: ${endDate.toDateString()} ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`);
