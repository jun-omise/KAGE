/**
 * グローバルエラーハンドラ
 * 全ルートの後に配置すること
 */
export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: '認証が必要です' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'サーバーエラーが発生しました'
      : err.message,
  });
}
