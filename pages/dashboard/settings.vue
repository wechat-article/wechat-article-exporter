<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-xl font-semibold text-cc-text">设置</h1>
    </Teleport>

    <div class="cc-settings-page h-full overflow-scroll">
      <SettingProxy />
      <div class="cc-settings-grid mt-4">
        <SettingExport />
        <SettingMisc />
      </div>
      <!--      <div>-->
      <!--        <SettingDisplay />-->
      <!--      </div>-->
      <div class="h-16"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SettingExport from '~/components/setting/Export.vue';
import SettingMisc from '~/components/setting/Misc.vue';
import SettingProxy from '~/components/setting/Proxy.vue';
import { websiteName } from '~/config';

useHead({
  title: `设置 | ${websiteName}`,
});
</script>
