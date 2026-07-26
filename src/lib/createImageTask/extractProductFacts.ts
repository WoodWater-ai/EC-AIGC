export interface ProductFactsInput {
  name: string;
  sellingPoints: string;
  productCategory: string;
  colorPattern: string;
  fabricTexture: string;
  fitStructure: string;
}

export interface ProductFacts {
  name: string;
  sellingPoints: string;
  category: string;
  color: string;
  patternAndMaterial: string;
  structure: string;
}

/**
 * 从 UI 表单字段提取"商品事实"用于 prompt 拼接。
 * 字段语义与 EC-AIGC 当前"商品信息"表单一致(productCategory → category,colorPattern → color,fabricTexture → patternAndMaterial,fitStructure → structure)。
 * 同时给字段做 trim,保证空字符串不参与拼接产生"  "。
 *
 * [2026-07-26 修复] 加 null-safe:? + ?? ''。原因:后端 imagePlanApi.analyze 返回的
 * productFacts 字段可能为 null(LLM 没识别某字段),runAssistantAnalysis 直接
 * setFormInput(resp.productFacts) 写入 state,导致 input.sellingPoints === null,
 * 旧实现 input.sellingPoints.trim() 抛 "Cannot read properties of undefined (reading 'trim')"。
 */
export function extractProductFacts(input: ProductFactsInput): ProductFacts {
  const trim = (s: string | null | undefined): string => (s ?? '').trim();
  return {
    name: trim(input.name),
    sellingPoints: trim(input.sellingPoints),
    category: trim(input.productCategory),
    color: trim(input.colorPattern),
    patternAndMaterial: trim(input.fabricTexture),
    structure: trim(input.fitStructure),
  };
}
