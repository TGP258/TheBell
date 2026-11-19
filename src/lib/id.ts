let seq = 0;

/**
 * 生成全局唯一、可用 SQLite INTEGER 存储的 id。
 * 时间戳（毫秒）× 1000 + 自增序列，远小于 Number.MAX_SAFE_INTEGER。
 */
export function newId(): number {
  seq = (seq + 1) % 1000;
  return Date.now() * 1000 + seq;
}
