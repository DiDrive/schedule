'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Loader2, RefreshCw } from 'lucide-react';
import { Task, Resource, ScheduleResult } from '@/types/schedule';

interface AISuggestionProps {
  tasks: Task[];
  resources: Resource[];
  scheduleResult: ScheduleResult;
  constraints?: {
    maxConcurrentTasks?: number;
    budgetLimit?: number;
    riskTolerance?: number;
  };
}

export default function AISuggestion({
  tasks,
  resources,
  scheduleResult,
  constraints
}: AISuggestionProps) {
  const [suggestion, setSuggestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateSuggestion = async () => {
    setIsLoading(true);
    setError('');
    setSuggestion('');
    setHasGenerated(false);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/schedule-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks,
          resources,
          scheduleResult,
          constraints
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('生成建议失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setHasGenerated(true);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setSuggestion(prev => prev + parsed.content);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      setHasGenerated(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('生成已取消');
      } else {
        setError(err instanceof Error ? err.message : '生成建议时出错');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    generateSuggestion();
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI 智能排期建议
            </CardTitle>
            <CardDescription className="mt-1">
              基于大语言模型的深度分析和优化建议
            </CardDescription>
          </div>
          {!isLoading && hasGenerated && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              重新生成
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasGenerated && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="h-12 w-12 text-purple-400 mb-4" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              点击下方按钮，AI 将基于当前项目数据生成智能排期建议
            </p>
            <Button onClick={generateSuggestion} className="gap-2">
              <Brain className="h-4 w-4" />
              生成 AI 建议
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                AI 正在分析项目数据并生成建议...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {suggestion && !isLoading && (
          <div className="space-y-4">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
              <Badge className="mb-2 bg-purple-500">
                <Brain className="mr-1 h-3 w-3" />
                AI 建议
              </Badge>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {suggestion}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
