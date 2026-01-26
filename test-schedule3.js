// 测试修复后的排期算法

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

    console.log(`  工作日时间: ${startOfDay.getHours()}:${String(startOfDay.getMinutes()).padStart(2, '0')} - ${endOfDay.getHours()}:${String(endOfDay.getMinutes()).padStart(2, '0')}`);

    const lunchBreak = getLunchBreak(result);
    if (lunchBreak) {
      console.log(`  午休时间: ${lunchBreak.start.getHours()}:${String(lunchBreak.start.getMinutes()).padStart(2, '0')} - ${lunchBreak.end.getHours()}:${String(lunchBreak.end.getMinutes()).padStart(2, '0')}`);
    }

    if (result < startOfDay) {
      console.log(`  -> 工作时间未开始，调整到工作日开始时间`);
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
        console.log(`  -> 在午休前，可用工作时间: ${availableHours.toFixed(2)}小时 (到午休开始)`);
      } else {
        availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
        console.log(`  -> 在午休后，可用工作时间: ${availableHours.toFixed(2)}小时 (到下班)`);
      }
    } else {
      availableHours = (endOfDay.getTime() - result.getTime()) / (1000 * 60 * 60);
      console.log(`  -> 无午休，可用工作时间: ${availableHours.toFixed(2)}小时`);
    }

    const hoursToUse = Math.min(remainingHours, availableHours);
    console.log(`  -> 使用工时: ${hoursToUse.toFixed(2)}小时`);

    result.setTime(result.getTime() + hoursToUse * 60 * 60 * 1000);
    remainingHours -= hoursToUse;

    console.log(`  -> 新时间: ${result.getHours()}:${String(result.getMinutes()).padStart(2, '0')}, 剩余: ${remainingHours.toFixed(2)}小时`);

    if (remainingHours > 0) {
      if (lunchBreak && lunchBreak.start < lunchBreak.end &&
          result.getTime() === lunchBreak.start.getTime()) {
        console.log(`  -> 到达午休开始，跳到午休结束继续当天工作`);
        result.setTime(lunchBreak.end.getTime());
      } else if (result.getTime() >= endOfDay.getTime()) {
        console.log(`  -> 已到下班时间，跳到下一天 0:00`);
        result.setDate(result.getDate() + 1);
        result.setHours(0, 0, 0, 0);
      } else {
        console.log(`  -> 继续在同一天工作`);
      }
    } else {
      console.log(`  -> 工时已完成！`);
    }
  }

  return result;
}

// 测试案例
const startDate = new Date(2025, 0, 27, 11, 35); // 1月27日（周一）11:35
const workHours = 8;

console.log(`开始时间: ${startDate.toDateString()} ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`);
console.log(`需要工作小时数: ${workHours}`);
console.log('=====================================');

const endDate = calculateEndDate(startDate, workHours);
console.log('\n=====================================');
console.log(`结束时间: ${endDate.toDateString()} ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`);

// 验证工作时间
console.log('\n预期结果:');
console.log('  第一天：11:35-12:00 (0.42h) + 13:30-19:00 (5.5h) = 5.92h');
console.log('  第二天：9:30-11:35 (2.08h)');
console.log('  总计：8.00h');
