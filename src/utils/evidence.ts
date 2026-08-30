/** 在用户点击事件中预开标签页，再异步装载受权限保护的 PDF，避免暴露对象存储 URL。 */
export async function openProtectedEvidence(load: () => Promise<Blob>): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  if (tab) {
    tab.opener = null;
    tab.document.title = '正在校验证据原件…';
    tab.document.body.textContent = '正在从受控存储读取并校验证据原件…';
  }
  try {
    const blob = await load();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.replace(url);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
