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

/**
 * 分页响应包装 —— 对应后端 com.github.pagehelper.PageInfo<T>
 *
 * 后端 PageHelper 的 PageInfo 字段:
 *   pageNum / pageSize / size / total / pages / list / prePage / nextPage ...
 *
 * 注意:前端组件只需关注 list + total + pageNum + pageSize + pages,
 * 其余字段(extendMap、firstPage、lastPage 等)忽略即可。
 *
 * 使用:
 *   const page = await assetApi.page({ pageNum: 1, pageSize: 20 });
 *   page.list    // 当前页数据
 *   page.total   // 总条数
 *   page.pages   // 总页数
 */
export interface PageInfo<T> {
  pageNum: number;
  pageSize: number;
  size: number;
  total: number;
  pages: number;
  list: T[];
  prePage: number;
  nextPage: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * 单 ID 响应 —— 对应后端 com.dafenqi.ai.web.model.response.BaseIdResponse
 *
 * 后端 id 字段已 @JsonSerialize(ToStringSerializer),前端拿到 string。
 * 用于 create 类接口的统一响应包装。
 */
export interface BaseIdResponse {
  id: string;
}
