<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 font-bold">技术支持 & 赞助</h1>
    </Teleport>
    <div class="px-6 py-4 flex-1 overflow-scroll">
      <p class="text-rose-500 text-3xl mb-10 font-medium">
        特别提示：<br />
        本工具不提供付费文章破解服务，请悉知。<br />
        但可以通过设置 Credentials 获取对应微信号已付费的文章内容。
      </p>

      <p class="my-5">
        首先，感谢大家使用我开发的工具！为了支持项目的持续完善与健康发展，我开通了以下赞助通道，成为赞助者可享受以下服务：
      </p>
      <ul class="space-y-2">
        <li>
          1)
          <span class="text-rose-400">私有部署支持</span
          >，帮助您将工具部署到自己的服务器(目前只能部署开源版本，详情请参考
          <a
            href="https://docs.wxdown.online/advanced/private-deploy.html"
            class="text-blue-500 hover:underline underline-offset-4"
            target="_blank"
            >私有部署</a
          >)；
        </li>
        <li>2) <span class="text-rose-400">代理节点搭建</span>，帮助搭建私有代理节点，优化下载速度；</li>
        <li>
          3)
          <span class="text-rose-400">本人一对一技术指导</span
          >，无论是使用中遇到的问题，还是需要理解工具原理方便二次开发，都将为您提供一对一技术指导。
        </li>
        <li>
          4) <span class="text-rose-400">享受后续付费服务的优惠政策</span>，后续将陆续开发一些
          <a
            target="_blank"
            class="text-blue-500 hover:underline underline-offset-4"
            href="https://github.com/jooooock/wechat-article-exporter/issues?q=is%3Aissue+label%3Apro%E8%AE%A1%E5%88%92+"
            >付费服务</a
          >，您可享受原价50%的一次性优惠。
        </li>
      </ul>

      <div class="mt-5 pl-3 border-l-4 border-emerald-500">
        <h3 class="">温馨提示</h3>
        <p class="">1. 若您在该项目早期曾打赏过该项目，可联系以下微信，提供您打赏时的转账单号，同样可享受以上服务。</p>
        <p class="">2. 赞助后可添加私人微信(<code>champkeh</code>，备注: 公众号文章下载)。</p>
      </div>

      <img class="w-96" src="~/assets/wechat-support.png" alt="" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { websiteName } from '~/config';

useHead({
  title: `技术支持 & 赞助 | ${websiteName}`,
});
</script>
