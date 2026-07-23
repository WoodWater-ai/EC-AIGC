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
 */
export function extractProductFacts(input: ProductFactsInput): ProductFacts {
  return {
    name: input.name.trim(),
    sellingPoints: input.sellingPoints.trim(),
    category: input.productCategory.trim(),
    color: input.colorPattern.trim(),
    patternAndMaterial: input.fabricTexture.trim(),
    structure: input.fitStructure.trim(),
  };
}
