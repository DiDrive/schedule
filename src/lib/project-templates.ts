import { ProjectTemplate } from '@/types/schedule';

// 默认项目模板
export const defaultProjectTemplates: ProjectTemplate[] = [
  {
    id: 'template-buying-ads',
    name: '买量片项目',
    description: '适用于短视频广告买量项目，包含策划、拍摄、后期全流程',
    category: '买量片',
    color: '#8b5cf6',
    isDefault: true,
    tasks: [
      {
        id: 'task-1',
        sequence: 1,
        name: '创意策划',
        description: '分析产品卖点，确定广告创意方向，撰写脚本大纲',
        estimatedHours: 8,
        priority: 'high',
        taskType: '脚本',
        workType: '脚本',
        dependencies: [],
        notes: '需明确核心卖点和目标用户'
      },
      {
        id: 'task-2',
        sequence: 2,
        name: '分镜脚本',
        description: '绘制详细的分镜脚本和画面规划',
        estimatedHours: 16,
        priority: 'high',
        taskType: '脚本',
        workType: '脚本',
        dependencies: [1],
        notes: '包含画面构图、镜头运动、时长预估'
      },
      {
        id: 'task-3',
        sequence: 3,
        name: '平面设计',
        description: '设计广告所需平面素材',
        estimatedHours: 8,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [2],
        notes: '需与脚本风格统一'
      },
      {
        id: 'task-4',
        sequence: 4,
        name: '道具准备',
        description: '采购或准备拍摄所需的道具、服装',
        estimatedHours: 4,
        priority: 'high',
        taskType: '物料',
        workType: '物料',
        dependencies: [2],
        notes: '提前3天准备完成'
      },
      {
        id: 'task-5',
        sequence: 5,
        name: '拍摄制作',
        description: '完成视频拍摄工作',
        estimatedHours: 24,
        priority: 'high',
        taskType: '后期',
        workType: '后期',
        dependencies: [3, 4],
        notes: '需协调演员、场地、设备'
      },
      {
        id: 'task-6',
        sequence: 6,
        name: '粗剪',
        description: '根据分镜进行初步剪辑',
        estimatedHours: 16,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [5],
        notes: '确认故事线和基本节奏'
      },
      {
        id: 'task-7',
        sequence: 7,
        name: '精剪',
        description: '精细剪辑，调整画面和节奏',
        estimatedHours: 12,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],
        notes: '优化转场和镜头衔接'
      },
      {
        id: 'task-8',
        sequence: 8,
        name: '特效制作',
        description: '添加必要的视觉特效',
        estimatedHours: 8,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [7],

        notes: '根据需求添加字幕、贴纸等'
      },
      {
        id: 'task-8',
        sequence: 8,
        name: '配音配乐',
        description: '录制配音和选择背景音乐',
        estimatedHours: 4,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],

        notes: '配音情绪需与画面匹配'
      },
      {
        id: 'task-9',
        sequence: 9,
        name: '调色',
        description: '调整画面色彩风格',
        estimatedHours: 4,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],

        notes: '统一画面色调和氛围'
      },
      {
        id: 'task-10',
        sequence: 10,
        name: '最终合成',
        description: '合成所有元素，输出最终版本',
        estimatedHours: 4,
        priority: 'urgent',
        taskType: '后期',
        workType: '后期',
        dependencies: [7, 8, 9],

        notes: '检查音画同步和质量'
      },
      {
        id: 'task-11',
        sequence: 11,
        name: '审片修改',
        description: '根据反馈进行修改优化',
        estimatedHours: 8,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [10],

        notes: '预留修改时间'
      }
    ]
  },
  {
    id: 'template-promo',
    name: '宣传片项目',
    description: '适用于企业宣传片，包含策划、拍摄、后期全流程',
    category: '宣传片',
    color: '#3b82f6',
    isDefault: true,
    tasks: [
      {
        id: 'task-1',
        sequence: 1,
        name: '需求分析',
        description: '了解企业背景、品牌调性和宣传目标',
        estimatedHours: 8,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [],

      },
      {
        id: 'task-2',
        sequence: 2,
        name: '创意构思',
        description: '制定宣传片的创意方案和叙事结构',
        estimatedHours: 16,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [1],

      },
      {
        id: 'task-3',
        sequence: 3,
        name: '脚本撰写',
        description: '撰写完整的解说词和分镜脚本',
        estimatedHours: 16,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [2],

      },
      {
        id: 'task-4',
        sequence: 4,
        name: '美术设计',
        description: '设计视觉风格、色调方案',
        estimatedHours: 12,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [3],

      },
      {
        id: 'task-5',
        sequence: 5,
        name: '前期筹备',
        description: '协调场地、设备、人员等',
        estimatedHours: 8,
        priority: 'high',
        taskType: '物料',
        workType: '物料',
        dependencies: [3],

      },
      {
        id: 'task-6',
        sequence: 6,
        name: '实地拍摄',
        description: '完成主要内容的拍摄工作',
        estimatedHours: 40,
        priority: 'high',
        taskType: '后期',
        workType: '后期',
        dependencies: [4, 5],

      },
      {
        id: 'task-7',
        sequence: 7,
        name: '素材整理',
        description: '整理和备份所有拍摄素材',
        estimatedHours: 8,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],

      },
      {
        id: 'task-8',
        sequence: 8,
        name: '剪辑初稿',
        description: '完成第一版剪辑',
        estimatedHours: 32,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [7],

      },
      {
        id: 'task-9',
        sequence: 9,
        name: '后期包装',
        description: '添加字幕、图表、特效等包装元素',
        estimatedHours: 24,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [8],

      },
      {
        id: 'task-10',
        sequence: 10,
        name: '配音配乐',
        description: '录制解说词和配乐',
        estimatedHours: 8,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [8],

      },
      {
        id: 'task-11',
        sequence: 11,
        name: '调色输出',
        description: '调色并输出最终版本',
        estimatedHours: 12,
        priority: 'urgent',
        taskType: '后期',
        workType: '后期',
        dependencies: [9, 10],

      }
    ]
  },
  {
    id: 'template-ad',
    name: '广告片项目',
    description: '适用于商业广告片制作',
    category: '广告片',
    color: '#10b981',
    isDefault: true,
    tasks: [
      {
        id: 'task-1',
        sequence: 1,
        name: '品牌分析',
        description: '分析品牌定位和产品特点',
        estimatedHours: 8,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [],

      },
      {
        id: 'task-2',
        sequence: 2,
        name: '创意提案',
        description: '准备多个创意方案供选择',
        estimatedHours: 16,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [1],

      },
      {
        id: 'task-3',
        sequence: 3,
        name: '方案确认',
        description: '确定最终创意方案',
        estimatedHours: 4,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [2],

      },
      {
        id: 'task-4',
        sequence: 4,
        name: '分镜制作',
        description: '制作详细分镜',
        estimatedHours: 16,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [3],

      },
      {
        id: 'task-5',
        sequence: 5,
        name: '拍摄准备',
        description: '场地、演员、设备准备',
        estimatedHours: 8,
        priority: 'high',
        taskType: '物料',
        workType: '物料',
        dependencies: [4],

      },
      {
        id: 'task-6',
        sequence: 6,
        name: '广告拍摄',
        description: '完成拍摄工作',
        estimatedHours: 32,
        priority: 'high',
        taskType: '后期',
        workType: '后期',
        dependencies: [4, 5],

      },
      {
        id: 'task-7',
        sequence: 7,
        name: '初剪',
        description: '粗剪版本',
        estimatedHours: 16,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],

      },
      {
        id: 'task-8',
        sequence: 8,
        name: '后期合成',
        description: '特效、调色、配乐',
        estimatedHours: 24,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [7],

      },
      {
        id: 'task-9',
        sequence: 9,
        name: '精修输出',
        description: '最终修改和输出',
        estimatedHours: 8,
        priority: 'urgent',
        taskType: '后期',
        workType: '后期',
        dependencies: [8],

      }
    ]
  },
  {
    id: 'template-doc',
    name: '纪录片项目',
    description: '适用于纪录片制作',
    category: '纪录片',
    color: '#f59e0b',
    isDefault: true,
    tasks: [
      {
        id: 'task-1',
        sequence: 1,
        name: '选题策划',
        description: '确定纪录片的主题和角度',
        estimatedHours: 16,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [],

      },
      {
        id: 'task-2',
        sequence: 2,
        name: '采访大纲',
        description: '准备采访问题和提纲',
        estimatedHours: 12,
        priority: 'high',
        taskType: '平面',
        workType: '平面',
        dependencies: [1],

      },
      {
        id: 'task-3',
        sequence: 3,
        name: '前期调研',
        description: '实地调研和踩点',
        estimatedHours: 16,
        priority: 'high',
        taskType: '物料',
        workType: '物料',
        dependencies: [2],

      },
      {
        id: 'task-4',
        sequence: 4,
        name: '采访拍摄',
        description: '进行采访和素材拍摄',
        estimatedHours: 40,
        priority: 'high',
        taskType: '后期',
        workType: '后期',
        dependencies: [3],

      },
      {
        id: 'task-5',
        sequence: 5,
        name: '素材整理',
        description: '整理所有采访和拍摄素材',
        estimatedHours: 16,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [4],

      },
      {
        id: 'task-6',
        sequence: 6,
        name: '初剪',
        description: '根据采访内容进行剪辑',
        estimatedHours: 32,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [5],

      },
      {
        id: 'task-7',
        sequence: 7,
        name: '配音',
        description: '录制解说词',
        estimatedHours: 8,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [6],

      },
      {
        id: 'task-8',
        sequence: 8,
        name: '精剪调色',
        description: '精剪和调色处理',
        estimatedHours: 24,
        priority: 'normal',
        taskType: '后期',
        workType: '后期',
        dependencies: [7],

      },
      {
        id: 'task-9',
        sequence: 9,
        name: '最终输出',
        description: '输出最终版本',
        estimatedHours: 8,
        priority: 'urgent',
        taskType: '后期',
        workType: '后期',
        dependencies: [8],

      }
    ]
  }
];
