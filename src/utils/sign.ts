import { hmacSha256Hex } from './crypto';

/**
 * 请求签名工具 —— 与后端 SignUtils 算法对齐
 *
 * 后端算法来源：dafenqi-ai/src/main/java/com/dafenqi/ai/common/utils/SignUtils.java
 *   1. body JSON 按 key 字母序排序
 *   2. 签名字符串：`nonce=<>&timestamp=<>&params=<sortedJson>`
 *   3. HMAC-SHA256(signString, secret)
 *
 * 当前状态：后端 SignFilter 验签 if 块被注释（dafenqi-ai/interceptor/SignFilter.java:64-69）
 *   即使 SignatureConfig.enabled=true，验签逻辑也不会执行
 *
 * 后续当后端取消注释时，在 axios 请求拦截器中调用 signRequest() 注入 3 个 header：
 *   - X-Sign: 签名 hex
 *   - X-Sign-Nonce: 随机字符串（去重，防重放）
 *   - X-Sign-Timestamp: 毫秒时间戳
 *
 * 前端 sign 工具**预埋**在这里，目前不在 axios 拦截器中调用，避免无谓的额外计算。
 * 等后端启用时一行配置即可接入（见 src/api/client.ts 的注释 TODO）。
 */

const DEFAULT_SIGN_SECRET = 'prezzie-sign-key'; // 与后端 SignatureConfig 默认值一致

/**
 * 生成 32 字符随机 nonce（hex）
 */
function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * body 按 key 字母序排序后序列化为 JSON
 *
 * 与后端 TreeMap(ORDER_MAP_ENTRIES_BY_KEYS)对齐
 * 只处理一层对象（登录请求体是平的）
 */
function sortedBodyJson(body: unknown): string {
  if (!body || typeof body !== 'object') return '{}';
  const obj = body as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

export interface SignedRequestHeaders {
  'X-Sign': string;
  'X-Sign-Nonce': string;
  'X-Sign-Timestamp': string;
}

/**
 * 计算签名 + 返回 3 个 header
 *
 * 用法（暂未在拦截器启用，后端验签打开时接入）：
 *   if (config.data && typeof config.data === 'object') {
 *     Object.assign(config.headers, signRequest(config.data));
 *   }
 */
export function signRequest(
  body: unknown,
  secret: string = DEFAULT_SIGN_SECRET
): SignedRequestHeaders {
  const nonce = generateNonce();
  const timestamp = Date.now();
  const sortedJson = sortedBodyJson(body);
  const signString = `nonce=${nonce}&timestamp=${timestamp}&params=${sortedJson}`;
  const sign = hmacSha256Hex(signString, secret);

  return {
    'X-Sign': sign,
    'X-Sign-Nonce': nonce,
    'X-Sign-Timestamp': String(timestamp),
  };
}