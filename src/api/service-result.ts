/**
 * 对应后端 com.dafenqi.ai.common.result.ServiceResult<T>
 *
 * 后端 @JsonInclude(ALWAYS) → 即便字段为 null 也会输出键
 * 因此前端 type 必须把全部字段标可选（除 success）
 *
 * 来源：dafenqi-ai/src/main/java/com/dafenqi/ai/common/result/ServiceResult.java
 */
export interface ServiceResult<T> {
  /** true 成功，false 失败（唯一非可选字段） */
  success: boolean;
  /** 错误码；后端 GlobalExceptionHandler 用 EnumServiceException 填入 */
  errCode?: string;
  /** 错误信息；后端 messageSource.getMessage(errCode, [], zh_CN) i18n 渲染 */
  errMessage?: string;
  /** 业务数据；拦截器解构后业务代码直接拿这个 */
  data?: T;
  /** 后端响应时间戳（后端默认 System.currentTimeMillis()） */
  timestamp?: number;
  /** 处理时长（毫秒），后端业务方选填 */
  costTime?: number;
}
