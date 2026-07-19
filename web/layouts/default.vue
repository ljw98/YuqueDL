<template>
  <div class="app-frame">
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="app-brand">
          <div class="app-brand-logo">语</div>
          <div>
            <div class="app-brand-title">Yuque DL</div>
            <div class="app-brand-sub">知识库下载控制台</div>
          </div>
        </div>

        <nav class="app-nav">
          <NuxtLink to="/">
            <el-icon><Download /></el-icon>
            <span>下载</span>
          </NuxtLink>
          <NuxtLink to="/tasks">
            <el-icon><List /></el-icon>
            <span>任务</span>
          </NuxtLink>
          <NuxtLink to="/library">
            <el-icon><FolderOpened /></el-icon>
            <span>知识库</span>
          </NuxtLink>
          <NuxtLink to="/settings">
            <el-icon><Setting /></el-icon>
            <span>设置</span>
          </NuxtLink>
        </nav>

        <div class="sidebar-promo">
          <h4>快速开始</h4>
          <p>在设置中保存语雀 Token，然后到下载页粘贴知识库链接即可开始。</p>
          <div class="sidebar-promo-actions">
            <el-button size="small" round plain style="--el-button-bg-color:transparent;color:#fff;border-color:rgba(255,255,255,.25)">
              <NuxtLink to="/settings" style="color:inherit">去设置</NuxtLink>
            </el-button>
            <el-button size="small" round type="primary">
              <NuxtLink to="/" style="color:inherit">开始下载</NuxtLink>
            </el-button>
          </div>
        </div>
      </aside>

      <section class="app-main">
        <div class="content">
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, List, FolderOpened, Setting } from '@element-plus/icons-vue'
</script>
