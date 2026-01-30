'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, GitBranch, BarChart3 } from 'lucide-react';
import BasicScenario from '@/components/scenarios/basic-scenario';
import ComplexScenario from '@/components/scenarios/complex-scenario';
import { generateSchedule } from '@/lib/schedule-algorithms';
import { generateIntelligentAnalysis } from '@/lib/intelligent-analysis';
import { basicScenarioSample, complexScenarioSample } from '@/lib/sample-data';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

export default function ProjectScheduleSystem() {
  const [activeTab, setActiveTab] = useState('basic');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  唯变项目排期系统
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  智能排期 · 人员优化 · 风险管控
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="basic" className="gap-2">
              <Calendar className="h-4 w-4" />
              基础场景
            </TabsTrigger>
            <TabsTrigger value="complex" className="gap-2">
              <GitBranch className="h-4 w-4" />
              复杂场景
            </TabsTrigger>
          </TabsList>

          {/* Basic Scenario Tab */}
          <TabsContent value="basic">
            <BasicScenario />
          </TabsContent>

          {/* Complex Scenario Tab */}
          <TabsContent value="complex">
            <ComplexScenario />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
