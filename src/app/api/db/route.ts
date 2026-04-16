import { NextRequest, NextResponse } from 'next/server';
import { getAllData, syncTasksBatch, syncResourcesBatch, setCalendarExtraWorkDays } from '@/storage/database/server-client';

export async function GET() {
  try {
    const data = await getAllData();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[API/db] 获取数据失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tasks, resources, calendarExtraWorkDays } = body;

    switch (action) {
      case 'sync_tasks':
        if (tasks && Array.isArray(tasks)) {
          await syncTasksBatch(tasks);
        }
        break;
      case 'sync_resources':
        if (resources && Array.isArray(resources)) {
          await syncResourcesBatch(resources);
        }
        break;
      case 'sync_all':
        if (tasks && Array.isArray(tasks)) {
          await syncTasksBatch(tasks);
        }
        if (resources && Array.isArray(resources)) {
          await syncResourcesBatch(resources);
        }
        if (calendarExtraWorkDays) {
          await setCalendarExtraWorkDays(calendarExtraWorkDays);
        }
        break;
      case 'sync_calendar':
        if (calendarExtraWorkDays) {
          await setCalendarExtraWorkDays(calendarExtraWorkDays);
        }
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/db] 保存数据失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
