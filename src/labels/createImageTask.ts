// src/labels/createImageTask.ts
// 集中所有"创建图片任务"页面新增文案(i18n 占位,本期直接 export 对象)

export const messages = {
  readiness: {
    selectMain:
      '请先选择已关联商品资产的主体素材。',
    completePrompts:
      '请至少填写一个图片类型的 Prompt。',
    selectExecutionParams:
      '请选择完整的执行参数。',
    unsupportedSpec:
      '当前模型通道或输出规格不可执行，请调整设置。',
  },
  assistant: {
    idle: 'AI 助手',
    processing: 'AI 解析中',
    complete: '已根据商品事实与参考图填充 Prompt，可继续微调',
    retry: '重新生成',
    timeout: '解析超时(5 分钟),请重试',
  },
  facts: {
    name: '商品名称',
    sellingPoints: '核心卖点',
    category: '品类',
    color: '颜色',
    patternAndMaterial: '图案 / 材质',
    structure: '版型 / 结构',
    factPlaceholder: '待 AI 解析',
  },
  type: {
    product_main: '商品主图',
    scene_detail: '场景主图',
    detail_closeup: '细节图',
    model_triple_view: '三视图',
    labelHelper: '可多选',
  },
  template: {
    select: '选择模板',
    change: '更换模板',
    emptyHint: '尚未选择模板',
    sourceLabel: '来源',
  },
  typeIcon: {
    product_main: 'inventory_2',
    scene_detail: 'landscape',
    detail_closeup: 'zoom_in',
    model_triple_view: 'accessibility_new',
  } as const,
  refSlot: {
    detail: '细节', style: '风格', scene: '场景', pose: '姿势', model: '模特',
  } as const,
  refSlotIcon: {
    detail: 'zoom_in', style: 'palette', scene: 'landscape', pose: 'accessibility_new', model: 'face_3',
  } as const,
  presetPlatforms: [
    { name: '电商主图推荐', ratio: '1:1',  resolution: '2048px' },
    { name: '详情页长图',   ratio: '3:4',  resolution: '1536px' },
    { name: '内容种草竖图', ratio: '4:5',  resolution: '1536px' },
  ] as const,
  ratioLabel: '比例',
  resolutionLabel: '图片尺寸',
  totalCountLabel: '本次总张数',
  aspectRatioTag: '--ar',
  header: {
    eyebrow: '图片任务工作台',
    title: '新建多类型图片任务',
    readiness: '生成准备度',
    reviewLabel: '启用评分审核',
  },
  banner: {
    icon: 'error',
  },
  prompt: {
    regen: '按表单重算',
    aiOptimize: 'AI 建议',
    placeholder: '支持手写 Prompt；点击「按表单重算」或「AI 建议」',
  },
  conflict: {
    title: '模型能力与当前规格冲突',
    desc: '目标模型不支持当前的 {fields}。确认后将自动切换到该模型首个可用比例、尺寸，并将张数限制在上限内。',
    cancel: '保留当前选择',
    confirm: '确认调整',
  },
  executeConfirm: {
    title: '请确认本次生成',
    submit: '提交任务',
    cancel: '再检查一下',
  },
  overwrite: {
    title: '切换模板会覆盖当前 Prompt',
    desc: '你已经手动编辑过 Prompt。切换模板将清空当前每类型 Prompt 的覆盖内容。',
    cancel: '取消',
    confirm: '覆盖并切换',
  },
  unsupported: {
    title: '当前模型不支持该比例/尺寸/张数',
    fix: '请调整比例、尺寸或选择其他模型。',
  },
};
