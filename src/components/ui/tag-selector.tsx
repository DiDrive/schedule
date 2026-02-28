'use client';

import { useState, useMemo } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface TagOption {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface TagSelectorProps {
  options: TagOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  placeholder?: string;
  allowCustom?: boolean;
  onCustomAdd?: (name: string) => void;
}

export default function TagSelector({
  options,
  selected,
  onChange,
  max,
  placeholder = '选择标签',
  allowCustom = false,
  onCustomAdd,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [customTagName, setCustomTagName] = useState('');

  // 过滤选项
  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lowerSearch = searchText.toLowerCase();
    return options.filter(option =>
      option.name.toLowerCase().includes(lowerSearch) ||
      option.description?.toLowerCase().includes(lowerSearch)
    );
  }, [options, searchText]);

  // 按分类分组
  const groupedOptions = useMemo(() => {
    const groups: Record<string, TagOption[]> = {};
    filteredOptions.forEach(option => {
      const category = option.category || '其他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(option);
    });
    return groups;
  }, [filteredOptions]);

  // 已选标签
  const selectedOptions = useMemo(() => {
    return options.filter(option => selected.includes(option.id));
  }, [options, selected]);

  // 切换选中状态
  const handleToggle = (optionId: string) => {
    if (selected.includes(optionId)) {
      onChange(selected.filter(id => id !== optionId));
    } else {
      if (max && selected.length >= max) {
        alert(`最多只能选择 ${max} 个标签`);
        return;
      }
      onChange([...selected, optionId]);
    }
  };

  // 移除已选标签
  const handleRemove = (optionId: string) => {
    onChange(selected.filter(id => id !== optionId));
  };

  // 添加自定义标签
  const handleAddCustom = () => {
    if (!customTagName.trim()) return;
    if (onCustomAdd) {
      onCustomAdd(customTagName.trim());
      setCustomTagName('');
    }
  };

  return (
    <div className="space-y-3">
      {/* 已选标签展示 */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map(option => (
            <Badge
              key={option.id}
              variant="secondary"
              className="gap-1 px-2 py-1 text-sm"
            >
              {option.name}
              <button
                onClick={() => handleRemove(option.id)}
                className="ml-1 hover:bg-slate-700 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {max && (
            <span className="text-xs text-slate-500 self-center">
              {selected.length}/{max}
            </span>
          )}
        </div>
      )}

      {/* 选择器面板 */}
      <div className="border rounded-md">
        {/* 触发按钮 */}
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between h-10 px-3"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-slate-500">
            {selected.length === 0 ? placeholder : `已选 ${selected.length} 个标签`}
          </span>
          <Plus className="h-4 w-4 text-slate-400" />
        </Button>

        {/* 展开面板 */}
        {isOpen && (
          <div className="border-t p-3 space-y-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索标签..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* 标签列表 */}
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {Object.entries(groupedOptions).map(([category, opts]) => (
                  <div key={category}>
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      {category}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {opts.map(option => {
                        const isSelected = selected.includes(option.id);
                        return (
                          <Badge
                            key={option.id}
                            variant={isSelected ? "default" : "outline"}
                            className={`
                              cursor-pointer transition-colors
                              ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}
                            `}
                            onClick={() => handleToggle(option.id)}
                          >
                            {option.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredOptions.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-4">
                    没有找到匹配的标签
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 自定义标签添加 */}
            {allowCustom && onCustomAdd && (
              <div className="flex gap-2">
                <Input
                  placeholder="添加自定义标签..."
                  value={customTagName}
                  onChange={(e) => setCustomTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustom}
                  disabled={!customTagName.trim()}
                >
                  添加
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
