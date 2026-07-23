export type TaskType = 'book' | 'docs' | 'batch' | 'user'
export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
export type TaskSource = 'manual' | 'schedule' | 'retry'

export interface TaskOptions {
  ignoreImg?: boolean
  ignoreAttachments?: boolean | string
  token?: string
  key?: string
  password?: string
  toc?: boolean
  incremental?: boolean
  convertMarkdownVideoLinks?: boolean
  hideFooter?: boolean
}

export interface TaskLog {
  ts: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export interface TaskRecord {
  id: string
  type: TaskType
  urls: string[]
  options: TaskOptions
  status: TaskStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  current: number
  total: number
  message?: string
  error?: string
  bookPath?: string
  bookName?: string
  targetBooks?: string[]
  source?: TaskSource
  scheduleId?: string
  logs: TaskLog[]
}

export interface LibraryBook {
  name: string
  path: string
  mtime: number
  hasIndex: boolean
  /** total bytes under the book directory */
  size?: number
  /** bytes under media-like dirs (img/assets/attachments/...) */
  mediaSize?: number
}

export interface TreeNode {
  label: string
  path: string
  type: 'dir' | 'file'
  children?: TreeNode[]
  lazy?: boolean
}

export interface AppSettingsPublic {
  key?: string
  ignoreImg?: boolean
  /** false=下载附件；true=忽略全部；string=仅忽略后缀，如 "mp4,pdf" */
  ignoreAttachments?: boolean | string
  toc?: boolean
  incremental?: boolean
  convertMarkdownVideoLinks?: boolean
  hideFooter?: boolean
  token?: string
  hasToken?: boolean
  hasAccessPassword?: boolean
  /** 是否启用登录保护；关闭后即使已设密码也不强制登录 */
  accessAuthEnabled?: boolean
  maxConcurrency?: number
}

export interface AuthStatus {
  required: boolean
  authenticated: boolean
}
