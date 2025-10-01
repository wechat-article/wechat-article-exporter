<template>
  <USelectMenu
    v-model="selected"
    size="md"
    color="gray"
    :options="sortedAccountInfos"
    option-attribute="nickname"
    placeholder="请选择公众号"
  >
    <template #label>
      <UAvatar v-if="selected" :src="IMAGE_PROXY + selected.round_head_img" size="2xs" />
      <span v-if="selected" class="max-w-30 line-clamp-1">{{ selected.nickname }}</span>
      <span v-if="selected" class="shrink-0">({{ selected.albums!.length }}个合集)</span>
    </template>
    <template #option="{ option: account }">
      <UAvatar :src="IMAGE_PROXY + account.round_head_img" size="sm" />
      <div>
        <p class="text-[16px]">{{ account.nickname }}</p>
        <p class="text-gray-500 text-sm">合集数: {{ account.albums.length }}</p>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import { getAllInfo, type Info } from '~/store/v2/info';
import type { AppMsgAlbumInfo } from '~/types/types';
import { getArticleCache } from '~/store/v2/article';
import { IMAGE_PROXY } from '~/config';

interface AccountInfo extends Info {
  albums?: AppMsgAlbumInfo[];
}

// 已缓存的公众号信息
const cachedAccountInfos: AccountInfo[] = reactive(await getAllInfo());
cachedAccountInfos.forEach(async accountInfo => {
  accountInfo.albums = await getAllAlbums(accountInfo.fakeid);
});
const sortedAccountInfos = computed(() => {
  cachedAccountInfos.sort((a, b) => {
    if (a.albums && b.albums) {
      return a.albums.length > b.albums.length ? -1 : 1;
    } else {
      return 0;
    }
  });
  return cachedAccountInfos;
});

// 获取公众号下所有的合集数据（根据已缓存的文章数据）
async function getAllAlbums(fakeid: string) {
  const articles = await getArticleCache(fakeid, Date.now());
  const albums: AppMsgAlbumInfo[] = [];
  articles
    .flatMap(article => article.appmsg_album_infos)
    .forEach(album => {
      if (!albums.some(a => a.id === album.id)) {
        albums.push(album);
      }
    });

  return albums;
}

const selected = defineModel<AccountInfo | undefined>();
</script>
