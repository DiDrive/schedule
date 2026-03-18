'use client';

import { useEffect } from 'react';

export default function ForceReload() {
  useEffect(() => {
    localStorage.clear();
    window.location.href = '/';
  }, []);

  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">正在清除缓存并刷新...</h1>
      <p>请稍候</p>
    </div>
  );
}
