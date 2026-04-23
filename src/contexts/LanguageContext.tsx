import { createContext, useContext, useState, ReactNode } from 'react'

type Lang = 'en' | 'zh'
interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }
const LanguageContext = createContext<LangCtx | null>(null)

export const translations: Record<Lang, Record<string, string>> = {
  en: {
    'lang.switch': '中文',

    // Landing left panel
    'landing.title':        'See the Transformations',
    'landing.label.living': 'Living Room',
    'landing.label.bedroom':'Bedroom',
    'landing.stat1.n': '5 min',  'landing.stat1.l': 'Micro-tasks',
    'landing.stat2.n': 'AI',     'landing.stat2.l': 'Powered',
    'landing.stat3.n': 'ADHD',   'landing.stat3.l': 'Friendly',
    'landing.benefits.title': 'WHEN YOU CREATE AN ACCOUNT',
    'landing.benefit1': '📈 Track your streak and watch your habit grow',
    'landing.benefit2': '🏆 Earn points and level up as you go',
    'landing.benefit3': '📸 Save every before & after — your visual record',
    'landing.benefit4': '🔁 Pick up exactly where you left off, every time',

    // Auth right panel
    'auth.welcome':      'Welcome back',
    'auth.welcome.sub':  'Sign in to continue your journey',
    'auth.start':        'Get started',
    'auth.start.sub':    'No credit card. No overwhelm. Just one room.',
    'auth.email':        'Email',
    'auth.password':     'Password',
    'auth.signin.btn':   'Sign in',
    'auth.create.btn':   'Create account',
    'auth.google':       'Continue with Google',
    'auth.guest':        'Try it without logging in',
    'auth.no.account':   "Don't have an account? Sign up",
    'auth.has.account':  'Already have an account? Sign in',
    'auth.tos':          'By continuing, you agree to our',
    'auth.tos.terms':    'Terms of Service',
    'auth.tos.and':      'and',
    'auth.tos.privacy':  'Privacy Policy',

    // Dashboard
    'dash.greeting.sub':    'Small wins are still wins.',
    'dash.streak':          'Day streak',
    'dash.tasks.done':      'Tasks done',
    'dash.points':          'Points',
    'dash.level':           'Level',
    'dash.pts.next':        'pts to next level',
    'dash.capture.title':   'Capture a space',
    'dash.capture.sub':     'Take a photo and let AI create your personalized challenges',
    'dash.active.title':    'Active challenges',
    'dash.rooms':           'rooms',
    'dash.challenges.done': 'challenges done',

    // Capture
    'capture.title':            'Capture Space',
    'capture.guest.badge':      'Guest preview',
    'capture.upload.btn':       'Upload a photo of your space',
    'capture.upload.sub':       'No judgment. AI reads the mess, not your worth.',
    'capture.intent.label':     "What's your goal?",
    'capture.tidy':             'Tidy Up',
    'capture.tidy.sub':         'Put things back in their places',
    'capture.declutter':        'Declutter',
    'capture.declutter.sub':    "Remove items you don't need",
    'capture.redesign':         'Redesign',
    'capture.redesign.sub':     'Reorganize for better flow',
    'capture.analyze.btn':      'Create My Challenges',
    'capture.analyzing':        'AI is analyzing your space...',
    'capture.vision.loading':   'Creating your vision...',
    'capture.vision.sub':       'AI is imagining your transformed space',
    'capture.ready.title':      'Challenges Ready! 🎉',
    'capture.ready.sub':        'Your vision is being created... You can start now or wait!',
    'capture.start.btn':        'Start My Challenges',
    'capture.start.loading':    'Start While Vision Loads',
    'capture.skip.vision':      'Skip vision, start challenges →',

    // Challenge page
    'challenge.now.doing':      'Now doing',
    'challenge.remaining':      'remaining',
    'challenge.encourage':      "Focus on this one thing. You've got this! 💪",
    'challenge.progress.btn':   'Upload progress photo',
    'challenge.progress.earn':  '· earn bonus pts',
    'challenge.music.title':    'Countdown music',
    'challenge.music.sub':      'Add rhythm to your countdown',
    'challenge.music.playing':  'playing while timer runs',
    'challenge.music.waiting':  'will play when timer starts',
    'challenge.done.btn':       'Done!',
    'challenge.pause.btn':      'Pause',
    'challenge.continue.btn':   'Continue',
    'challenge.restart.btn':    'Restart',
    'challenge.skip.btn':       'Skip',
    'challenge.complete.title': 'All Done! 🎉',
    'challenge.complete.sub':   "You've completed all challenges for this space!",
    'challenge.back.home':      'Back to Home',
    'challenge.guest.title':    'You crushed it! 🎉',
    'challenge.guest.sub':      'You just completed a full declutter session. Imagine what you could do with streaks, points, and your progress saved.',
    'challenge.save.title':     'Save your progress',
    'challenge.save.sub':       'Create a free account to track your streaks, earn points, and keep your transformation history.',
    'challenge.create.btn':     'Create free account',
    'challenge.signin.link':    'Sign in instead',

    // Onboarding overlay
    'onboard.title':  "Let's start with\none room.",
    'onboard.sub':    'Take a photo and AI will break it into small, doable tasks. No overwhelm. Just one thing at a time.',
    'onboard.micro':  'Takes 30 seconds to get your first challenge',
    'onboard.cta':    '📷 Take a photo now',
    'onboard.skip':   "I'll explore first",

    // Music vibe labels
    'vibe.lofi':  '🎵 lofi focus',
    'vibe.chill': '🌊 chill waves',
    'vibe.upbeat':'⚡ upbeat',
    'vibe.night': '🌙 night calm',
    'vibe.indie': '🎸 indie pop',
  },

  zh: {
    'lang.switch': 'English',

    // Landing left panel
    'landing.title':        '整理前 vs 整理后',
    'landing.label.living': '客厅',
    'landing.label.bedroom':'卧室',
    'landing.stat1.n': '5分钟', 'landing.stat1.l': '小任务',
    'landing.stat2.n': 'AI',    'landing.stat2.l': '智能规划',
    'landing.stat3.n': 'ADHD',  'landing.stat3.l': '友好设计',
    'landing.benefits.title': '注册账户后你可以',
    'landing.benefit1': '📈 记录连续整理天数，养成好习惯',
    'landing.benefit2': '🏆 完成任务获得积分，不断升级',
    'landing.benefit3': '📸 保存每次的前后对比照片',
    'landing.benefit4': '🔁 随时回来，从上次中断的地方继续',

    // Auth right panel
    'auth.welcome':      '欢迎回来',
    'auth.welcome.sub':  '登录继续你的整理之旅',
    'auth.start':        '免费开始',
    'auth.start.sub':    '无需信用卡。没有压力。先整理一个房间。',
    'auth.email':        '邮箱',
    'auth.password':     '密码',
    'auth.signin.btn':   '登录',
    'auth.create.btn':   '免费注册',
    'auth.google':       '使用 Google 账号登录',
    'auth.guest':        '先体验，不用注册',
    'auth.no.account':   '还没有账户？注册',
    'auth.has.account':  '已有账户？登录',
    'auth.tos':          '继续即表示你同意我们的',
    'auth.tos.terms':    '服务条款',
    'auth.tos.and':      '和',
    'auth.tos.privacy':  '隐私政策',

    // Dashboard
    'dash.greeting.sub':    '小进步也是进步。',
    'dash.streak':          '连续天数',
    'dash.tasks.done':      '已完成任务',
    'dash.points':          '积分',
    'dash.level':           '等级',
    'dash.pts.next':        '积分可升级',
    'dash.capture.title':   '整理一个新空间',
    'dash.capture.sub':     '拍一张照片，AI为你生成个性化挑战清单',
    'dash.active.title':    '进行中的挑战',
    'dash.rooms':           '个房间',
    'dash.challenges.done': '个任务已完成',

    // Capture
    'capture.title':            '拍摄空间',
    'capture.guest.badge':      '访客体验',
    'capture.upload.btn':       '上传你的空间照片',
    'capture.upload.sub':       '不评判，AI分析的是房间，不是你这个人。',
    'capture.intent.label':     '你想做什么？',
    'capture.tidy':             '整理归位',
    'capture.tidy.sub':         '把东西放回原处',
    'capture.declutter':        '断舍离',
    'capture.declutter.sub':    '清除不再需要的物品',
    'capture.redesign':         '重新布局',
    'capture.redesign.sub':     '重新规划，让空间更顺手',
    'capture.analyze.btn':      '分析我的空间',
    'capture.analyzing':        '正在读取你的房间...',
    'capture.vision.loading':   '正在生成整理愿景图...',
    'capture.vision.sub':       'AI正在想象你的空间变身后的样子',
    'capture.ready.title':      '挑战准备好了！🎉',
    'capture.ready.sub':        '愿景图还在生成中，你可以现在开始，也可以等一下！',
    'capture.start.btn':        '开始我的挑战',
    'capture.start.loading':    '边生成边开始',
    'capture.skip.vision':      '跳过愿景图，直接开始 →',

    // Challenge page
    'challenge.now.doing':      '正在进行',
    'challenge.remaining':      '剩余时间',
    'challenge.encourage':      '专注做这一件事，你可以的！💪',
    'challenge.progress.btn':   '上传进度照片',
    'challenge.progress.earn':  '· 获得额外积分',
    'challenge.music.title':    '倒计时音乐',
    'challenge.music.sub':      '给倒计时加点节奏感',
    'challenge.music.playing':  '计时中播放',
    'challenge.music.waiting':  '开始计时后播放',
    'challenge.done.btn':       '完成！',
    'challenge.pause.btn':      '暂停',
    'challenge.continue.btn':   '继续',
    'challenge.restart.btn':    '重新计时',
    'challenge.skip.btn':       '跳过',
    'challenge.complete.title': '全部完成！🎉',
    'challenge.complete.sub':   '你完成了这个空间的所有挑战！',
    'challenge.back.home':      '返回首页',
    'challenge.guest.title':    '你做到了！🎉',
    'challenge.guest.sub':      '你刚完成了一次完整的整理。注册后可以保存进度、积累连续天数和积分。',
    'challenge.save.title':     '保存你的进度',
    'challenge.save.sub':       '创建免费账户，追踪连续天数、赚取积分、保存你的变身记录。',
    'challenge.create.btn':     '免费创建账户',
    'challenge.signin.link':    '已有账户，去登录',

    // Onboarding overlay
    'onboard.title':  '先从一个房间开始。',
    'onboard.sub':    '拍一张照片，AI会帮你拆解成小的、可执行的任务。一次只做一件事，没有压力。',
    'onboard.micro':  '30秒就能拿到你的第一个任务清单',
    'onboard.cta':    '📷 现在拍一张照片',
    'onboard.skip':   '先看看再说',

    // Music vibe labels
    'vibe.lofi':  '🎵 专注轻音乐',
    'vibe.chill': '🌊 海浪放松',
    'vibe.upbeat':'⚡ 活力节拍',
    'vibe.night': '🌙 深夜平静',
    'vibe.indie': '🎸 独立流行',
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('tidymate_lang') as Lang
    if (saved === 'en' || saved === 'zh') return saved
    return navigator.language?.startsWith('zh') ? 'zh' : 'en'
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('tidymate_lang', l)
  }

  const t = (key: string): string =>
    translations[lang][key] ?? translations['en'][key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
