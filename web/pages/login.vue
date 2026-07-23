<template>
  <div class="login-page">
    <div class="login-bg" aria-hidden="true">
      <span class="blob blob-a" />
      <span class="blob blob-b" />
      <span class="blob blob-c" />
    </div>

    <div class="login-card">
      <div class="login-brand">
        <div class="login-logo" aria-hidden="true">
          <svg viewBox="0 0 1121 1024" xmlns="http://www.w3.org/2000/svg" width="28" height="26">
            <path d="M1108.01815019 152.23370838l-89.72681904-4.89068759S984.35530601 25.85425236 828.60518734 14.95438794C672.85605155 4.05747208 570.94772487 10.89912728 570.94772487 10.89912728s115.53266578 75.04689342 69.23232192 208.96190045c-34.40189852 72.22708179-88.82848936 131.24065795-146.85822745 199.06356549l-383.7165077 446.83547013c357.19612521-5.34378385 567.78465104-8.01715006 631.76852607-8.01715006 179.43398097 0 331.07773051-158.77731274 324.87296549-335.43767627-4.26657452-121.41308858-42.14974625-148.84556072-55.1715951-202.01999401-13.01693457-53.17541615 13.04248882-137.97419909 96.94294209-168.05153463z" fill="#31CC79"/>
            <path d="M491.75514811 420.36840754C303.9413435 636.79804197 8.77812571 981.15119797 8.77812571 981.15119797c531.00326003 142.20833939 775.65656505-202.93110079 813.9672788-322.41582742 51.36204825-160.1985214-21.21001572-238.36892872-62.2835355-263.86222751-139.26272229-86.43818547-242.58930905-4.60369387-268.7067209 25.49329879z" fill="#93E65C"/>
            <path d="M494.36266302 415.3735373c29.79329038-32.14919435 131.07848684-106.92875115 266.17881727-22.74130417 41.07745119 25.59355001 113.65344659 104.07945386 62.28746691 264.931574-14.88042808 46.60502898-60.9026239 127.39474547-142.75284119 200.40712857-84.8744628 0.58283314-275.36654789 3.09009681-571.48510096 7.53161958L474.61218731 438.31730962a8405.73366256 8405.73366256 0 0 1 18.93470588-22.06215119z" fill="#60DB69"/>
          </svg>
        </div>
        <div class="login-brand-text">
          <h1>Yuque DL</h1>
          <p>知识库下载控制台</p>
        </div>
      </div>

      <el-form class="login-form" label-position="top" @submit.prevent="login">
        <el-form-item label="访问密码">
          <el-input
            v-model="password"
            type="password"
            show-password
            size="large"
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="login"
          />
        </el-form-item>
        <el-button
          class="login-submit"
          type="primary"
          size="large"
          :loading="loading"
          @click="login"
        >
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})

const password = ref('')
const loading = ref(false)
const route = useRoute()

async function login() {
  if (!password.value) {
    ElMessage.warning('请输入密码')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: password.value },
    })
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect || '/')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const status = await $fetch<{ required: boolean; authenticated: boolean }>('/api/auth/status')
    if (!status.required || status.authenticated) {
      await navigateTo('/')
    }
  } catch {
    // ignore
  }
})
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100dvh;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 28px 20px;
  padding-top: max(28px, env(safe-area-inset-top, 0px));
  padding-bottom: max(28px, env(safe-area-inset-bottom, 0px));
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  background:
    linear-gradient(160deg, #f3fbf6 0%, #f7f8fd 45%, #eef7ff 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(10px);
}

.blob-a {
  width: 420px;
  height: 420px;
  left: -120px;
  top: -80px;
  background: radial-gradient(circle, rgba(49, 204, 121, 0.28), rgba(49, 204, 121, 0) 70%);
}

.blob-b {
  width: 480px;
  height: 480px;
  right: -140px;
  bottom: -120px;
  background: radial-gradient(circle, rgba(96, 219, 105, 0.22), rgba(96, 219, 105, 0) 70%);
}

.blob-c {
  width: 280px;
  height: 280px;
  left: 45%;
  top: 18%;
  background: radial-gradient(circle, rgba(147, 230, 92, 0.16), rgba(147, 230, 92, 0) 70%);
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(400px, 100%);
  /* 按内容自然高度，不再强制撑高 */
  padding: 32px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(232, 235, 245, 0.95);
  box-shadow:
    0 1px 2px rgba(28, 39, 76, 0.04),
    0 18px 48px rgba(28, 39, 76, 0.08);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
  flex-shrink: 0;
}

.login-logo {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: linear-gradient(145deg, #e8f9f0, #f7fff9);
  border: 1px solid rgba(49, 204, 121, 0.16);
  box-shadow: 0 10px 24px rgba(49, 204, 121, 0.14);
}

.login-brand-text h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  color: #1b1f3b;
  letter-spacing: 0.2px;
}

.login-brand-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #8b92a8;
}

.login-form {
  margin-top: 0;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-form :deep(.el-form-item__label) {
  color: #5b617a;
  font-weight: 500;
  margin-bottom: 8px !important;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px #e8ebf5 inset;
  min-height: 44px;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #31cc79 inset,
    0 0 0 3px rgba(49, 204, 121, 0.14) !important;
}

.login-submit {
  width: 100%;
  height: 44px;
  border-radius: 12px !important;
  font-weight: 600;
  letter-spacing: 0.2px;
  background: linear-gradient(135deg, #31cc79, #60db69) !important;
  border-color: transparent !important;
  box-shadow: 0 10px 22px rgba(49, 204, 121, 0.28);
}

.login-submit:hover,
.login-submit:focus {
  filter: brightness(1.02);
}

@media (max-width: 480px) {
  .login-page {
    padding: 16px 12px;
    padding-top: max(16px, env(safe-area-inset-top, 0px));
    padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
    align-items: start;
  }

  .login-card {
    min-height: 0;
    padding: 24px 18px;
    border-radius: 16px;
    width: 100%;
  }

  .login-brand {
    min-height: 0;
    margin-bottom: 22px;
  }

  .login-logo {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .login-brand-text h1 {
    font-size: 20px;
  }
}
</style>
