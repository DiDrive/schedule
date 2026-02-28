'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Resource } from '@/types/schedule';
import {
  getSkills,
  getSpecialties,
} from '@/lib/skill-config';
import TagSelector from '@/components/ui/tag-selector';

interface ResourceSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
  selectedSkills: string[];
  selectedSpecialties: string[];
  onSkillsChange: (skills: string[]) => void;
  onSpecialtiesChange: (specialties: string[]) => void;
  onSave: () => void;
}

export default function ResourceSkillsDialog({
  open,
  onOpenChange,
  resource,
  selectedSkills,
  selectedSpecialties,
  onSkillsChange,
  onSpecialtiesChange,
  onSave,
}: ResourceSkillsDialogProps) {

  const handleSave = () => {
    onSave();
  };

  const allSkills = getSkills();
  const allSpecialties = getSpecialties();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>配置技能和擅长</DialogTitle>
          <DialogDescription>
            为 {resource?.name || '资源'} 配置技能和擅长领域
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 技能选择 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">技能</Label>
            <TagSelector
              options={allSkills.map(s => ({ id: s.id, name: s.name, description: s.description, category: s.category }))}
              selected={selectedSkills}
              onChange={onSkillsChange}
              placeholder="选择技能"
            />
          </div>

          {/* 擅长选择 */}
          <div>
            <Label className="text-sm font-medium mb-2 block">擅长</Label>
            <TagSelector
              options={allSpecialties.map(s => ({ id: s.id, name: s.name, description: s.description, category: s.category }))}
              selected={selectedSpecialties}
              onChange={onSpecialtiesChange}
              placeholder="选择擅长"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Check className="h-4 w-4" />
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
