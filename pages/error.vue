<template>
  <NuxtLayout>
    <div class="bg-[#f0f2f5] text-gray-900">
      <div class="flex min-h-screen flex-col items-center justify-center text-center">
        <div class="relative mb-8">
          <svg
            class="h-40 w-40 text-red-500"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
            <line x1="1" x2="23" y1="1" y2="23"></line>
          </svg>
        </div>
        <div class="relative">
          <h1 class="glitch text-6xl font-bold text-[#0A0A0A] md:text-8xl" data-text="ERROR">ERROR</h1>
        </div>
        <h2 class="mt-4 text-3xl font-bold tracking-tight text-gray-800 sm:text-4xl">出了点小状况</h2>
        <p class="mt-4 text-base text-gray-600">抱歉，页面出现了一些问题。请稍后重试。</p>
        <div v-if="errorCode" class="mt-6 text-sm text-gray-500 opacity-75">
          <p>
            Error Code: <span class="font-mono">{{ errorCode }}</span>
          </p>
        </div>
        <a
          class="mt-8 inline-flex items-center justify-center rounded-lg bg-[#0A0A0A] px-5 py-3 text-base font-medium text-white shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] focus:ring-offset-2 focus:ring-offset-background-light"
          href="/"
        >
          返回主页
        </a>
      </div>
    </div>
  </NuxtLayout>
</template>

<script lang="ts" setup>
import { websiteName } from '~/config/index.js';

useHead({
  title: `出了点小状况 | ${websiteName}`,
});

const route = useRoute();
const router = useRouter();
const errorCode = computed(() => route.query.error);
</script>

<style scoped>
.glitch {
  position: relative;
  animation: glitch 1s infinite;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.glitch::before {
  left: 2px;
  text-shadow: -2px 0 #ff00c1;
  animation: glitch-anim 1s infinite;
  clip: rect(44px, 450px, 56px, 0);
}

.glitch::after {
  left: -2px;
  text-shadow:
    -2px 0 #00fff9,
    2px 2px #ff00c1;
  animation: glitch-anim-2 1s infinite;
  clip: rect(85px, 450px, 90px, 0);
}

@keyframes glitch {
  0% {
    transform: translate(0);
  }
  20% {
    transform: translate(-3px, 3px);
  }
  40% {
    transform: translate(-3px, -3px);
  }
  60% {
    transform: translate(3px, 3px);
  }
  80% {
    transform: translate(3px, -3px);
  }
  100% {
    transform: translate(0);
  }
}

@keyframes glitch-anim {
  0% {
    clip: rect(32px, 9999px, 89px, 0);
  }
  5% {
    clip: rect(51px, 9999px, 83px, 0);
  }
  10% {
    clip: rect(47px, 9999px, 12px, 0);
  }
  15% {
    clip: rect(7px, 9999px, 63px, 0);
  }
  20% {
    clip: rect(41px, 9999px, 54px, 0);
  }
  25% {
    clip: rect(15px, 9999px, 100px, 0);
  }
  30% {
    clip: rect(82px, 9999px, 3px, 0);
  }
  35% {
    clip: rect(10px, 9999px, 5px, 0);
  }
  40% {
    clip: rect(88px, 9999px, 73px, 0);
  }
  45% {
    clip: rect(78px, 9999px, 19px, 0);
  }
  50% {
    clip: rect(46px, 9999px, 20px, 0);
  }
  55% {
    clip: rect(8px, 9999px, 69px, 0);
  }
  60% {
    clip: rect(89px, 9999px, 45px, 0);
  }
  65% {
    clip: rect(57px, 9999px, 59px, 0);
  }
  70% {
    clip: rect(25px, 9999px, 98px, 0);
  }
  75% {
    clip: rect(13px, 9999px, 74px, 0);
  }
  80% {
    clip: rect(34px, 9999px, 26px, 0);
  }
  85% {
    clip: rect(98px, 9999px, 44px, 0);
  }
  90% {
    clip: rect(1px, 9999px, 35px, 0);
  }
  95% {
    clip: rect(62px, 9999px, 9px, 0);
  }
  100% {
    clip: rect(60px, 9999px, 4px, 0);
  }
}

@keyframes glitch-anim-2 {
  0% {
    clip: rect(61px, 9999px, 78px, 0);
  }
  5% {
    clip: rect(6px, 9999px, 55px, 0);
  }
  10% {
    clip: rect(10px, 9999px, 7px, 0);
  }
  15% {
    clip: rect(68px, 9999px, 76px, 0);
  }
  20% {
    clip: rect(20px, 9999px, 24px, 0);
  }
  25% {
    clip: rect(90px, 9999px, 21px, 0);
  }
  30% {
    clip: rect(78px, 9999px, 39px, 0);
  }
  35% {
    clip: rect(2px, 9999px, 57px, 0);
  }
  40% {
    clip: rect(59px, 9999px, 30px, 0);
  }
  45% {
    clip: rect(11px, 9999px, 60px, 0);
  }
  50% {
    clip: rect(3px, 9999px, 62px, 0);
  }
  55% {
    clip: rect(4px, 9999px, 86px, 0);
  }
  60% {
    clip: rect(56px, 9999px, 95px, 0);
  }
  65% {
    clip: rect(40px, 9999px, 6px, 0);
  }
  70% {
    clip: rect(80px, 9999px, 70px, 0);
  }
  75% {
    clip: rect(81px, 9999px, 47px, 0);
  }
  80% {
    clip: rect(93px, 9999px, 36px, 0);
  }
  85% {
    clip: rect(31px, 9999px, 99px, 0);
  }
  90% {
    clip: rect(87px, 9999px, 22px, 0);
  }
  95% {
    clip: rect(100px, 9999px, 52px, 0);
  }
  100% {
    clip: rect(12px, 9999px, 23px, 0);
  }
}

.glitch::before,
.glitch::after {
  background: #f0f2f5;
}
</style>
