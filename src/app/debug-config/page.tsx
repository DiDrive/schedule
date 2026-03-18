'use client';

import { useState, useEffect } from 'react';

export default function DebugConfigPage() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const configStr = localStorage.getItem('feishu-config');
    if (configStr) {
      setConfig(JSON.parse(configStr));
    }
  }, []);

  const handleClear = () => {
    localStorage.removeItem('feishu-config');
    setConfig(null);
    alert('配置已清除！');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">飞书配置诊断</h1>
      
      {config ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="font-semibold text-green-800">✅ 配置已找到</h2>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">完整配置:</h3>
            <pre className="text-xs overflow-auto max-h-96 bg-white p-4 rounded border">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-blue-800">数据源模式</h3>
              <p className="text-blue-600">{config.dataSourceMode || '未设置'}</p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-blue-800">需求表加载模式</h3>
              <p className="text-blue-600">{config.requirementsLoadMode || '未设置'}</p>
            </div>
          </div>
          
          {config.newMode && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-purple-800">需求表模式配置</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>App Token:</strong> {config.newMode.appToken || '❌ 未设置'}</div>
                <div><strong>人员表 ID:</strong> {config.newMode.tableIds?.resources || '❌ 未设置'}</div>
                <div className="col-span-2 p-2 bg-yellow-50 rounded">
                  <strong>需求表1 ID:</strong> 
                  <span className={config.newMode.tableIds?.requirements1 ? 'text-green-600' : 'text-red-600'}>
                    {config.newMode.tableIds?.requirements1 || '❌ 未设置'}
                  </span>
                </div>
                <div className="col-span-2 p-2 bg-yellow-50 rounded">
                  <strong className="text-red-700">需求表2 ID:</strong> 
                  <span className={config.newMode.tableIds?.requirements2 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                    {config.newMode.tableIds?.requirements2 || '❌ 未设置 - 这就是问题所在！'}
                  </span>
                </div>
                <div><strong>排期表 ID:</strong> {config.newMode.tableIds?.schedules || '未设置'}</div>
              </div>
            </div>
          )}
          
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            清除配置
          </button>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-800">❌ 未找到配置</h2>
          <p className="text-red-600">localStorage 中没有飞书配置</p>
        </div>
      )}
    </div>
  );
}
