import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskTimelinePanel, type TimelineTask } from './TaskTimelinePanel';

const snapshot: TimelineTask['snapshot'] = {
  taskId: 'task-1',
  promptType: 'scene_detail',
  totalCount: 4,
  selectedTypes: ['scene_detail'],
  typeCounts: {
    product_main: 0,
    scene_detail: 4,
    detail_closeup: 0,
    model_triple_view: 0,
    product_detail: 0,
  },
  prompt: 'test prompt',
  positivePrompt: '正面提示词',
  negativePrompt: '负面提示词',
  modelId: 'vidu-q3',
  aspectRatio: '1:1',
  resolution: '1K',
  referenceCount: 1,
};

test('completed batch renders three COS thumbnails', () => {
  const task: TimelineTask = {
    groupId: 'group-00000001',
    submittedAt: '2026-08-27T08:00:00.000Z',
    status: 'done',
    taskStatus: 'ARCHIVED',
    progressPercent: 100,
    resultCount: 4,
    error: null,
    snapshot,
    resultPreviews: [
      { id: 'image-1', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/1.png' },
      { id: 'image-2', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/2.png' },
      { id: 'image-3', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/3.png' },
      { id: 'image-4', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/4.png' },
    ],
  };

  const html = renderToStaticMarkup(React.createElement(TaskTimelinePanel, {
    tasks: [task],
    activeTaskId: null,
    onSelect: () => undefined,
  }));

  assert.match(html, /当前商品任务队列/);
  assert.equal((html.match(/data-timeline-thumbnail="true"/g) ?? []).length, 3);
  assert.match(html, /1\.png\?imageMogr2\/thumbnail\/160x/);
  assert.doesNotMatch(html, /4\.png\?imageMogr2\/thumbnail\/160x/);
});

test('loading batch fills thumbnail slots with fixed-size skeletons', () => {
  const task: TimelineTask = {
    groupId: 'group-00000002',
    submittedAt: '2026-08-27T08:00:00.000Z',
    status: 'loading',
    taskStatus: 'GENERATING',
    progressPercent: 25,
    resultCount: 1,
    error: null,
    snapshot: { ...snapshot, totalCount: 3 },
    resultPreviews: [
      { id: 'image-1', taskId: 'task-1', mediaType: 'IMAGE', url: 'https://cdn.example.com/1.png' },
    ],
  };

  const html = renderToStaticMarkup(React.createElement(TaskTimelinePanel, {
    tasks: [task],
    activeTaskId: null,
    onSelect: () => undefined,
  }));

  assert.equal((html.match(/data-timeline-thumbnail="true"/g) ?? []).length, 1);
  assert.equal((html.match(/data-timeline-skeleton="true"/g) ?? []).length, 2);
});

test('failed batch keeps the abnormal state and shows an empty result count', () => {
  const task: TimelineTask = {
    groupId: 'group-00000003',
    submittedAt: '2026-08-27T08:00:00.000Z',
    status: 'done',
    taskStatus: 'FAILED',
    progressPercent: 100,
    resultCount: 0,
    error: 'provider unavailable',
    snapshot,
  };

  const html = renderToStaticMarkup(React.createElement(TaskTimelinePanel, {
    tasks: [task],
    activeTaskId: null,
    onSelect: () => undefined,
  }));

  assert.match(html, /异常/);
  assert.doesNotMatch(html, /共 0 张/);
  assert.equal((html.match(/data-timeline-skeleton="true"/g) ?? []).length, 0);
});

test('thumbnail fallback is supplied when every image URL is unavailable', () => {
  const task: TimelineTask = {
    groupId: 'group-00000004',
    submittedAt: '2026-08-27T08:00:00.000Z',
    status: 'done',
    taskStatus: 'ARCHIVED',
    progressPercent: 100,
    resultCount: 1,
    error: null,
    snapshot: { ...snapshot, totalCount: 1 },
    resultPreviews: [
      { id: 'image-5', taskId: 'task-1', mediaType: 'IMAGE', url: '', thumbnailUrl: '' },
    ],
  };

  const html = renderToStaticMarkup(React.createElement(TaskTimelinePanel, {
    tasks: [task],
    activeTaskId: null,
    onSelect: () => undefined,
  }));

  assert.match(html, /图片加载失败/);
});
