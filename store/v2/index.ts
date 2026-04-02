// 删除公众号数据
export async function deleteAccountData(ids: string[]): Promise<void> {
  await $fetch('/api/store/account', {
    method: 'POST',
    body: { action: 'delete', ids },
  });
}
