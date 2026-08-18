import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PUBLISH_TEMPLATE_NAME,
  getPublishTemplateDefaultName,
} from './publishTemplateName';

test('作品标题作为模板默认名称，保留商品名称', () => {
  assert.equal(
    getPublishTemplateDefaultName('商品主图 · 女士蕾丝吊带睡裙'),
    '商品主图 · 女士蕾丝吊带睡裙',
  );
});

test('缺少作品标题时使用统一兜底名称', () => {
  assert.equal(getPublishTemplateDefaultName('  '), DEFAULT_PUBLISH_TEMPLATE_NAME);
});
