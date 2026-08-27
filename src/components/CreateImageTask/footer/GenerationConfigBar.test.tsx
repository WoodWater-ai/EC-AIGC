import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GenerationConfigBar } from './GenerationConfigBar';

test('config bar shows execution settings and the existing price field, without reference counts', () => {
  const html = renderToStaticMarkup(React.createElement(GenerationConfigBar, {
    model: 'nano banana',
    aspectRatio: '3:4',
    resolution: '2K',
    totalCount: 4,
    costLabel: '预计 ¥12.00',
    onGenerate: () => undefined,
  }));

  assert.match(html, /本次配置/);
  assert.match(html, /nano banana/);
  assert.match(html, /3:4/);
  assert.match(html, /2K/);
  assert.match(html, /4 张/);
  assert.match(html, /预计 ¥12.00/);
  assert.match(html, /检查并生成/);
  assert.doesNotMatch(html, /模特 \d|场景 \d/);
});
