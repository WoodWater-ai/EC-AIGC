import CryptoJS from 'crypto-js';

/**
 * 加密工具 —— 与后端 PasswordUtil + SignUtils 算法对齐
 *
 * 后端算法来源：
 * - 密码：dafenqi-ai/common/utils/password/PasswordUtil.java
 *   encryptByMd5(md5Password, salt) = sha256Hex(salt + md5Password)
 *   前端需要把明文 password 做 MD5 后大写传过去，后端再 SHA-256 + salt
 * - 签名：dafenqi-ai/common/utils/SignUtils.java
 *   signString = "nonce=...&timestamp=...&params=...sortedJson..."
 *   HMAC-SHA256(signString, secret)
 */

/**
 * MD5 加密 + 转大写
 *
 * 用法：登录时把明文密码转成后端期望的格式
 *   const hashed = md5UpperCase('123456'); // "E10ADC3949BA59ABBE56E057F20F883E"
 *
 * 注意：浏览器 SubtleCrypto 不支持 MD5，所以这里用 crypto-js
 */
export function md5UpperCase(input: string): string {
  return CryptoJS.MD5(input).toString().toUpperCase();
}

/** 计算上传文件的内容 MD5（小写），供个人资源去重。 */
export async function md5FileHex(file: Blob): Promise<string> {
  const hasher = CryptoJS.algo.MD5.create();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    hasher.update(CryptoJS.lib.WordArray.create(buffer));
  }
  return hasher.finalize().toString(CryptoJS.enc.Hex).toLowerCase();
}

/** 计算原始文件 SHA-256，用于授权证据完整性留痕。 */
export async function sha256FileHex(file: Blob): Promise<string> {
  const hasher = CryptoJS.algo.SHA256.create();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    hasher.update(CryptoJS.lib.WordArray.create(buffer));
  }
  return hasher.finalize().toString(CryptoJS.enc.Hex).toLowerCase();
}

/**
 * HMAC-SHA256 加密（用于请求签名）
 *
 * 用法：在 axios 拦截器里同步计算请求签名（不要用 SubtleCrypto，因为是 async 的）
 */
export function hmacSha256Hex(message: string, secret: string): string {
  return CryptoJS.HmacSHA256(message, secret).toString(CryptoJS.enc.Hex);
}

