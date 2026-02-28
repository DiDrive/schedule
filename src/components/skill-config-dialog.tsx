'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Trash2, Settings } from 'lucide-react';
import { Skill, Specialty } from '@/types/schedule';
import {
  DEFAULT_SKILLS,
  DEFAULT_SPECIALTIES,
  getSkills,
  getSpecialties,
  saveCustomSkills,
  saveCustomSpecialties,
  clearCustomConfig,
} from '@/lib/skill-config';

interface SkillConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SkillConfigDialog({ open, onOpenChange }: SkillConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<'skills' | 'specialties'>('skills');
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [customSpecialties, setCustomSpecialties] = useState<Specialty[]>([]);

  // 表单状态
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'graphic' | 'post' | 'common'>('common');
  const [newSkillDescription, setNewSkillDescription] = useState('');
  
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [newSpecialtyCategory, setNewSpecialtyCategory] = useState('');
  const [newSpecialtyDescription, setNewSpecialtyDescription] = useState('');

  // 加载自定义数据
  useEffect(() => {
    if (open) {
      loadCustomData();
    }
  }, [open]);

  const loadCustomData = () => {
    try {
      const allSkills = getSkills();
      const customSkills = allSkills.filter(skill =>
        !DEFAULT_SKILLS.some(ds => ds.id === skill.id)
      );
      setCustomSkills(customSkills);

      const allSpecialties = getSpecialties();
      const customSpecialties = allSpecialties.filter(specialty =>
        !DEFAULT_SPECIALTIES.some(ds => ds.id === specialty.id)
      );
      setCustomSpecialties(customSpecialties);
    } catch (error) {
      console.error('加载自定义数据失败:', error);
    }
  };

  // 添加自定义技能
  const handleAddSkill = () => {
    if (!newSkillName.trim()) {
      alert('请输入技能名称');
      return;
    }

    const newSkill: Skill = {
      id: `custom-skill-${Date.now()}`,
      name: newSkillName.trim(),
      category: newSkillCategory,
      description: newSkillDescription.trim() || undefined,
    };

    const updatedSkills = [...customSkills, newSkill];
    setCustomSkills(updatedSkills);
    saveCustomSkills(updatedSkills);

    // 清空表单
    setNewSkillName('');
    setNewSkillDescription('');
  };

  // 删除自定义技能
  const handleDeleteSkill = (skillId: string) => {
    const updatedSkills = customSkills.filter(skill => skill.id !== skillId);
    setCustomSkills(updatedSkills);
    saveCustomSkills(updatedSkills);
  };

  // 添加自定义擅长
  const handleAddSpecialty = () => {
    if (!newSpecialtyName.trim()) {
      alert('请输入擅长名称');
      return;
    }

    const newSpecialty: Specialty = {
      id: `custom-specialty-${Date.now()}`,
      name: newSpecialtyName.trim(),
      category: newSpecialtyCategory.trim() || '其他',
      description: newSpecialtyDescription.trim() || undefined,
    };

    const updatedSpecialties = [...customSpecialties, newSpecialty];
    setCustomSpecialties(updatedSpecialties);
    saveCustomSpecialties(updatedSpecialties);

    // 清空表单
    setNewSpecialtyName('');
    setNewSpecialtyCategory('');
    setNewSpecialtyDescription('');
  };

  // 删除自定义擅长
  const handleDeleteSpecialty = (specialtyId: string) => {
    const updatedSpecialties = customSpecialties.filter(specialty => specialty.id !== specialtyId);
    setCustomSpecialties(updatedSpecialties);
    saveCustomSpecialties(updatedSpecialties);
  };

  // 重置为默认配置
  const handleResetToDefault = () => {
    if (confirm('确定要重置为默认配置吗？这将删除所有自定义的技能和擅长。')) {
      clearCustomConfig();
      setCustomSkills([]);
      setCustomSpecialties([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            技能和擅长配置
          </DialogTitle>
          <DialogDescription>
            管理自定义的技能和擅长领域
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'skills' | 'specialties')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="skills">技能</TabsTrigger>
            <TabsTrigger value="specialties">擅长</TabsTrigger>
          </TabsList>

          {/* 技能配置 */}
          <TabsContent value="skills" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 左侧：默认技能 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">默认技能（只读）</Label>
                <div className="border rounded-md p-3 h-64 overflow-y-auto space-y-2">
                  {DEFAULT_SKILLS.map(skill => (
                    <div key={skill.id} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                      <Badge variant="outline" className="text-xs">
                        {skill.category === 'graphic' ? '平面' : skill.category === 'post' ? '后期' : '通用'}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{skill.name}</div>
                        {skill.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{skill.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右侧：自定义技能 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">自定义技能</Label>
                <div className="border rounded-md p-3 h-64 overflow-y-auto space-y-2">
                  {customSkills.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-8">
                      暂无自定义技能
                    </div>
                  ) : (
                    customSkills.map(skill => (
                      <div key={skill.id} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded group">
                        <Badge variant="outline" className="text-xs">
                          {skill.category === 'graphic' ? '平面' : skill.category === 'post' ? '后期' : '通用'}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{skill.name}</div>
                          {skill.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{skill.description}</div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteSkill(skill.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 添加自定义技能表单 */}
            <div className="border rounded-md p-4 space-y-3">
              <Label className="text-sm font-medium">添加自定义技能</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">技能名称</Label>
                  <Input
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="例如：3D建模"
                  />
                </div>
                <div>
                  <Label className="text-xs">分类</Label>
                  <select
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value as any)}
                    className="w-full h-10 px-3 border rounded-md"
                  >
                    <option value="graphic">平面</option>
                    <option value="post">后期</option>
                    <option value="common">通用</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">描述（可选）</Label>
                <Input
                  value={newSkillDescription}
                  onChange={(e) => setNewSkillDescription(e.target.value)}
                  placeholder="简要描述该技能"
                />
              </div>
              <Button type="button" size="sm" onClick={handleAddSkill} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                添加技能
              </Button>
            </div>
          </TabsContent>

          {/* 擅长配置 */}
          <TabsContent value="specialties" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 左侧：默认擅长 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">默认擅长（只读）</Label>
                <div className="border rounded-md p-3 h-64 overflow-y-auto space-y-2">
                  {DEFAULT_SPECIALTIES.map(specialty => (
                    <div key={specialty.id} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                      <Badge variant="outline" className="text-xs">{specialty.category}</Badge>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{specialty.name}</div>
                        {specialty.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{specialty.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右侧：自定义擅长 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">自定义擅长</Label>
                <div className="border rounded-md p-3 h-64 overflow-y-auto space-y-2">
                  {customSpecialties.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-8">
                      暂无自定义擅长
                    </div>
                  ) : (
                    customSpecialties.map(specialty => (
                      <div key={specialty.id} className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded group">
                        <Badge variant="outline" className="text-xs">{specialty.category}</Badge>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{specialty.name}</div>
                          {specialty.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{specialty.description}</div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteSpecialty(specialty.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 添加自定义擅长表单 */}
            <div className="border rounded-md p-4 space-y-3">
              <Label className="text-sm font-medium">添加自定义擅长</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">擅长名称</Label>
                  <Input
                    value={newSpecialtyName}
                    onChange={(e) => setNewSpecialtyName(e.target.value)}
                    placeholder="例如：电商"
                  />
                </div>
                <div>
                  <Label className="text-xs">分类</Label>
                  <Input
                    value={newSpecialtyCategory}
                    onChange={(e) => setNewSpecialtyCategory(e.target.value)}
                    placeholder="例如：行业"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">描述（可选）</Label>
                <Input
                  value={newSpecialtyDescription}
                  onChange={(e) => setNewSpecialtyDescription(e.target.value)}
                  placeholder="简要描述该擅长领域"
                />
              </div>
              <Button type="button" size="sm" onClick={handleAddSpecialty} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                添加擅长
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部操作 */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleResetToDefault}
          >
            重置为默认配置
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
          >
            完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
