'use client';

import { useState, useEffect } from 'react';

export default function ForceFixPage() {
  const [status, setStatus] = useState('检查中...');
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
      
      console.log('[Force Fix] 当前配置:', parsed);
      console.log('[Force Fix] requirements2:', parsed.newMode?.tableIds?.requirements2);
      
      if (!parsed.newMode?.tableIds?.requirements2) {
        setStatus('发现问题：requirements2 为空，正在修复...');
        
        // 强制修复
        parsed.newMode.tableIds.requirements2 = 'tbl2DmMEixMBJMlJ';
        parsed.requirementsLoadMode = 'requirements2';
        
        localStorage.setItem('feishu-config', JSON.stringify(parsed));
        
        setStatus('✅ 修复完成！requirements2 已设置为 tbl2DmMEixMBJMlJ');
        setConfig({ ...parsed });
        
        console.log('[Force Fix] 修复后的配置:', parsed);
      } else {
        setStatus('✅ 配置正常！requirements2 已设置');
      }
    } else {
      setStatus('❌ 没有找到配置，请先在首页配置');
    }
  }, []);

  const handleTestLoad = async () => {
    if (!config) return;
    
    setStatus('正在测试加载需求表2...');
    
    try {
      const url = `/api/feishu/load-data?app_id=${encodeURIComponent(config.appId)}` +
        `&app_secret=${encodeURIComponent(config.appSecret)}` +
        `&app_token=${encodeURIComponent(config.newMode.appToken)}` +
        `&resources_table_id=${encodeURIComponent(config.newMode.tableIds.resources)}` +
        `&data_source_mode=new` +
        `&requirements_load_mode=requirements2` +
        `&requirements2_table_id=tbl2DmMEixMBJMlJ`;
      
      console.log('[Force Fix] 测试URL:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('[Force Fix] 加载结果:', result);
      
      if (result.success) {
        setStatus(`✅ 测试成功！加载了 ${result.data.tasks.length} 个任务`);
      } else {
        setStatus(`❌ 加载失败: ${result.error}`);
      }
    } catch (error) {
      setStatus(`❌ 加载异常: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔧 强制修复需求表2加载</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-yellow-800 mb-2">状态</h2>
        <p className="text-yellow-700">{status}</p>
      </div>
      
      {config && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-4">当前配置</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><strong>需求表2 ID:</strong></div>
            <div className={config.newMode?.tableIds?.requirements2 ? 'text-green-600' : 'text-red-600'}>
              {config.newMode?.tableIds?.requirements2 || '❌ 未设置'}
            </div>
            <div><strong>加载模式:</strong></div>
            <div>{config.requirementsLoadMode || '未设置'}</div>
          </div>
        </div>
      )}
      
      <div className="flex gap-4">
        <button
          onClick={handleTestLoad}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={!config}
        >
          🧪 测试加载需求表2
        </button>
        
        <a
          href="/"
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          ← 返回首页
        </a>
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">说明</h3>
        <ul className="list-disc list-inside text-blue-700 text-sm space-y-1">
          <li>此页面会强制设置需求表2的 ID 为 tbl2DmMEixMBJMlJ</li>
          <li>点击"测试加载"验证是否能正常加载需求表2的数据</li>
          <li>如果成功，返回首页正常使用即可</li>
        </ul>
      </div>
    </div>
  );
}
