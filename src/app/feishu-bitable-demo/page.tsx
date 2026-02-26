'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface BitableRecord {
  record_id: string;
  fields: Record<string, any>;
  created_time?: number;
  last_modified_time?: number;
}

interface BitableResponse {
  code: number;
  msg: string;
  data?: {
    items: BitableRecord[];
    total: number;
    page_token: string;
    has_more: boolean;
  };
}

export default function FeishuBitableDemo() {
  const [userToken, setUserToken] = useState<string>('');
  const [appToken, setAppToken] = useState<string>('');
  const [tableId, setTableId] = useState<string>('');
  const [records, setRecords] = useState<BitableRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [editingRecord, setEditingRecord] = useState<BitableRecord | null>(null);
  const [newRecordFields, setNewRecordFields] = useState<string>('{}');

  // 从 localStorage 获取用户令牌
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('feishu_user_access_token');
      if (token) {
        setUserToken(token);
      }
    }
  }, []);

  const showError = (message: string) => {
    setError(message);
    setSuccess('');
    setTimeout(() => setError(''), 5000);
  };

  const showSuccess = (message: string) => {
    setSuccess(message);
    setError('');
    setTimeout(() => setSuccess(''), 5000);
  };

  // 查询记录
  const fetchRecords = async () => {
    if (!appToken || !tableId) {
      showError('请输入 App Token 和 Table ID');
      return;
    }

    if (!userToken) {
      showError('请先完成飞书扫码登录');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/feishu/bitable?app_token=${encodeURIComponent(appToken)}&table_id=${encodeURIComponent(tableId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ page_size: 100 }),
        }
      );

      const data: BitableResponse = await response.json();

      if (!response.ok) {
        showError(data.msg || '获取数据失败');
        return;
      }

      if (data.data) {
        setRecords(data.data.items);
        showSuccess(`成功获取 ${data.data.items.length} 条记录`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 新增记录
  const addRecord = async () => {
    if (!appToken || !tableId) {
      showError('请输入 App Token 和 Table ID');
      return;
    }

    let fields;
    try {
      fields = JSON.parse(newRecordFields);
    } catch (err) {
      showError('JSON 格式错误，请检查字段格式');
      return;
    }

    if (!fields || typeof fields !== 'object') {
      showError('字段必须是一个有效的 JSON 对象');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/feishu/bitable/records?app_token=${encodeURIComponent(appToken)}&table_id=${encodeURIComponent(tableId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ fields }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showError(data.msg || '新增记录失败');
        return;
      }

      showSuccess('新增记录成功！');
      setNewRecordFields('{}');
      fetchRecords(); // 刷新列表
    } catch (err) {
      showError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 更新记录
  const updateRecord = async (recordId: string, fields: Record<string, any>) => {
    if (!appToken || !tableId) {
      showError('请输入 App Token 和 Table ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/feishu/bitable/records/${encodeURIComponent(recordId)}?app_token=${encodeURIComponent(appToken)}&table_id=${encodeURIComponent(tableId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ fields }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showError(data.msg || '更新记录失败');
        return;
      }

      showSuccess('更新记录成功！');
      setEditingRecord(null);
      fetchRecords(); // 刷新列表
    } catch (err) {
      showError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  // 删除记录
  const deleteRecord = async (recordId: string) => {
    if (!appToken || !tableId) {
      showError('请输入 App Token 和 Table ID');
      return;
    }

    if (!confirm('确定要删除这条记录吗？')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/feishu/bitable/records/${encodeURIComponent(recordId)}?app_token=${encodeURIComponent(appToken)}&table_id=${encodeURIComponent(tableId)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showError(data.msg || '删除记录失败');
        return;
      }

      showSuccess('删除记录成功！');
      fetchRecords(); // 刷新列表
    } catch (err) {
      showError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>飞书多维表 API 演示</CardTitle>
          <CardDescription>
            演示查询、新增、更新、删除记录四个核心功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 登录状态 */}
          <div className="space-y-2">
            <Label>登录状态</Label>
            <div className="flex items-center gap-2">
              {userToken ? (
                <span className="text-green-600">✅ 已登录</span>
              ) : (
                <span className="text-red-600">❌ 未登录</span>
              )}
              {!userToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = '/feishu-oauth'}
                >
                  去登录
                </Button>
              )}
            </div>
          </div>

          {/* 配置信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appToken">App Token</Label>
              <Input
                id="appToken"
                placeholder="请输入 App Token"
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tableId">Table ID</Label>
              <Input
                id="tableId"
                placeholder="请输入 Table ID"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <Button onClick={fetchRecords} disabled={loading}>
            {loading ? '加载中...' : '查询记录'}
          </Button>

          {/* 新增记录表单 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">新增记录</CardTitle>
              <CardDescription>输入 JSON 格式的字段数据</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newRecordFields">字段数据 (JSON)</Label>
                <Textarea
                  id="newRecordFields"
                  placeholder='{"text_field": "示例文本", "number_field": 123}'
                  value={newRecordFields}
                  onChange={(e) => setNewRecordFields(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={addRecord} disabled={loading}>
                {loading ? '添加中...' : '添加记录'}
              </Button>
            </CardContent>
          </Card>

          {/* 提示信息 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 记录列表 */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>记录列表 ({records.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {records.map((record) => (
                <Card key={record.record_id}>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="text-sm font-mono text-gray-600">
                        Record ID: {record.record_id}
                      </div>
                      <div className="space-y-2">
                        <Label>字段数据</Label>
                        <Textarea
                          value={JSON.stringify(record.fields, null, 2)}
                          readOnly
                          rows={6}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRecord(record)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteRecord(record.record_id)}
                          disabled={loading}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑对话框 */}
      {editingRecord && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg text-blue-700">编辑记录</CardTitle>
            <CardDescription>Record ID: {editingRecord.record_id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editFields">字段数据 (JSON)</Label>
              <Textarea
                id="editFields"
                value={JSON.stringify(editingRecord.fields, null, 2)}
                onChange={(e) => {
                  try {
                    const newFields = JSON.parse(e.target.value);
                    setEditingRecord({ ...editingRecord, fields: newFields });
                  } catch (err) {
                    // 不更新，等待有效 JSON
                  }
                }}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => updateRecord(editingRecord.record_id, editingRecord.fields)}
                disabled={loading}
              >
                {loading ? '保存中...' : '保存更改'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingRecord(null)}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
