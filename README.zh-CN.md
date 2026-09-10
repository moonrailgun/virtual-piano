# Echo Piano · 余音

[English](README.md) | **简体中文**

把 MP3 拖进浏览器，自动生成 88 键钢琴卷帘谱。支持落音动画、琴键高亮、钢琴重奏、原音对照、进度跳转、变速、手动弹奏和 MIDI 导出。

界面默认使用英语，可在页头切换为中文。语言选择保存在当前浏览器中，切换不会清空曲谱或中断播放。项目文档和开发内容以英语为主；双语词典位于 `src/i18n.ts`。

## 运行

需要 Node.js 22.18+（开发时使用 Node.js 24）。

```sh
npm install
npm run setup:audio
npm run dev
```

歌曲模式还需要 [uv](https://docs.astral.sh/uv/getting-started/installation/) 和 FFmpeg；`setup:audio` 在项目内创建 Python 3.11 环境并安装模型依赖。首次处理会下载 Demucs 权重；此后可使用本机缓存。`npm run dev` / `preview` 自动启动本机模型服务，无需 API Key。

打开终端显示的本地地址，选择「歌曲 · 含人声」后拖入歌曲。「钢琴演奏内容」默认选「人声主旋律」，保留主唱旋律与低音；选「背景伴奏」则去掉人声和鼓点，将乐器伴奏转为钢琴谱。切换音频类型或演奏内容会用已导入的文件重新生成，通过链接导入的音频也无需重新下载。钢琴、吉他等清晰乐器录音选择「纯乐器 · 多音转谱」，这一模式不需要 Python，示例也使用这个模式。点击琴键，或用 A–L 和相邻黑键快捷键弹奏；空格播放 / 暂停。

在「从音频或视频链接导入」粘贴公开链接。MP3、WAV、M4A、OGG、FLAC、AAC、Opus、AIFF 等音频文件优先由浏览器直接读取；受跨域限制或没有音频扩展名的链接交给服务器解析。服务器通过 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 支持 YouTube 等站点，并保留 B 站专用解析（`?p=2` 可选择分 P）。先下载全部音频、转换为 M4A，再核对解码时长，校验通过才返回转谱；试听片段、缺失分片、直播和无法确认时长的视频会报错。单次限制为 20 分钟 / 100 MB，处理时限 280 秒；取消会终止下载并删除临时文件。登录、付费、地区限制、站点不支持或反爬拦截仍可能导致失败，不会读取个人浏览器 Cookie。

打开 `/?importUrl=<编码后的来源链接>` 会自动导入并转谱，不会自动播放。用 `new URLSearchParams({ importUrl: sourceUrl })` 构造参数，保留来源链接自身的 `?p=2&...` 等参数。例如：`/?importUrl=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DjNQXAC9IVRw`。没有时长元数据的音频文件会在解码后校验。

切换「弹奏模式 → 简谱」，点击「查看键位图」打开悬浮面板，按实体键盘的错位布局展示完整键位，不会挤动曲谱。**QWER · UIOP** 对应高音区，**ASDF · JKL;** 对应中音区，**ZXCV · M,./** 对应低音区；左右手各四键，每排依次弹 1–7，再补下一八度的 1。键位图随调式更新，可随时收起。按住 **Shift** 让新按下的音升半音（例如 Shift+A 弹中音 ♯1），已经按住的音保持不变；可先按住普通音，再用 Shift 加入升音组成和弦。支持 12 个大调：C 大调的 A 弹 C4，D 大调的 A 弹 D4、D 弹 F♯4。落音和琴键显示数字、八度点及变化音标记，模式与调式会在当前浏览器中保存。切换时释放正在手弹的音符，并更新键位和标注；导入曲目的音高、播放及 MIDI 导出保持不变。这里提供数字落音视图，不是带节奏排版的传统简谱。

```sh
npm test
npm run test:audio
npm run build
npm run preview
```

本地开发时，歌曲模式通过 Vite 将音频发送到 `127.0.0.1:8001` 的 Python 服务；生产环境则分片上传到同源 Vercel Python 函数，完成或取消后删除临时文件。纯乐器模式在浏览器中转谱。中文衬线字体可从 Google Fonts 加载，加载失败时使用系统字体。

## 工作方式与边界

### Vercel 公网部署

在线体验：[Echo Piano](https://virtual-piano-sable.vercel.app)。

仓库：[moonrailgun/virtual-piano](https://github.com/moonrailgun/virtual-piano)。将该仓库导入 Vercel，`vercel.json` 已配置 Vite 构建和模型资产复制。同一次部署包含 Python 歌曲转谱函数和 Node.js 视频导入函数，访客无需安装 Python。

`api/video.mjs` 使用 Node.js 24，Vercel 函数超时为 300 秒；Vite dev/preview 使用同一接口。`npm install` 会下载固定版本且校验 SHA-256 的独立 yt-dlp 程序（包含 Python 和 YouTube EJS 解析器），并安装 `ffmpeg-static`。支持 macOS / Linux，`npm run setup:video` 可恢复下载器；Vercel 会将两个程序打包进函数。服务器校验完整音频后流式返回 M4A，浏览器再将歌曲交给歌曲服务，或自行处理纯乐器录音。下载经过本地代理，拦截内网和保留地址、固定已检查的 DNS 地址，并检查重定向目标。仅部署 `dist/` 不包含该接口。YouTube、B 站可能拦截数据中心 IP，需要单独验证实际部署的预览环境。

### 歌曲转谱函数

`api/transcribe.py` 使用 Python 3.12，根目录 `requirements.txt` 安装 CPU 版 PyTorch。Vercel 项目需启用 Fluid Compute；`vercel.json` 在构建时设置 `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`，启用大型 Python 函数，并将执行时限设为 300 秒。还需在项目的 Production 和 Preview 环境变量中设置 `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`，确保正式发布和 Git 构建使用相同上限。详见 [Vercel 函数限制](https://vercel.com/docs/functions/limitations)。

浏览器将整首歌解码为 44.1 kHz 立体声，以 5 秒为一段、两侧各保留 1 秒上下文，依次上传 PCM16 WAV；每次请求最大约 1.24 MB。函数内部使用 4 秒 Demucs 窗口控制内存，流式返回进度，以及人声/低音音符或 22,050 Hz 单声道 PCM16 伴奏。浏览器裁掉重叠区，按原时间轴连接音符或音频；伴奏再交给纯乐器模式使用的多音模型转谱。这满足 4.5 MB 请求限制，无需额外存储或另一台服务器。每段处理最多 270 秒，每个函数进程同时运行一个推理任务；取消会关闭当前请求并停止后续分段。

首次转谱下载 Demucs 权重，复用实例的 `/tmp` 缓存。音频分段在处理结束或断开连接后删除。`/api/health` 路由到同一个 Python 函数，仅检查接口可用性，不会预热或验证模型；上线前需在部署预览中检查真实歌曲。纯乐器模式仍在浏览器执行。

运行 `python3 tests/song_service_test.py` 可在不安装模型的情况下检查路由、请求限制和来源隔离。`npm test` 另覆盖分段大小、重叠合并、流中断和取消。

### 转谱方式

- **歌曲模式**：[Demucs](https://github.com/facebookresearch/demucs) 先分离人声、低音、鼓和其他伴奏，「人声主旋律」使用 [CREPE](https://github.com/maxrmorrison/torchcrepe) 分别追踪人声和低音的音高。音高轮廓经过短抖动过滤、停顿检测和音符切分，导出独立的旋律 / 低音 MIDI 轨道。「背景伴奏」合并低音和其他乐器声部，排除人声与鼓点，再用浏览器中的 Basic Pitch 生成多音钢琴轨道。5 秒分块，两侧保留上下文。优先使用 Apple MPS / CUDA，否则使用 CPU；CPU 推理较慢，整首歌曲的处理时间可能远长于播放时长。一次处理一首，支持取消，歌曲时长限制为 30 分钟。
- **纯乐器模式**：Web Audio 解码为 22,050 Hz 单声道；[Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts) 在 Web Worker 中通过 TensorFlow.js WASM 识别多音、起止时间和力度。分块推理并保留重叠区。

「人声主旋律」生成主唱旋律与低音的简化钢琴版，前奏、间奏可能较稀疏；「背景伴奏」保留识别到的和弦音符，适合弹伴奏或跟唱。分离可能残留人声或丢失乐器细节，转谱也可能漏音、多音。两者都不重建完整配器或指法，滑音、合唱和密集装饰音仍可能识别不准。纯乐器模式直接处理流行歌曲混音时容易把泛音和伴奏误识别为主旋律。两种模式都属于自动转谱初稿，输出按秒定位的卷帘谱与 MIDI，不是排版五线谱。原音仍使用导入的文件，钢琴重奏使用本地钢琴采样。

Basic Pitch 的旧 TensorFlow.js 3.x WASM `Fill` 内核无法处理补零时省略的 dtype，因此依赖统一使用修复后的 4.22.0，并通过 override 避免同时加载两套 TensorFlow。

## 浏览器验证

`npm test` 检查琴键布局、分块音符合并、跳转可见区、12 个大调映射、八度标注和双语词典一致性。另有不增加测试依赖的 Orca 浏览器检查：先在 Orca 打开预览地址（新启动的开发服务可能因优化模型依赖而刷新页面），再执行：

```sh
npm run test:browser -- <browser-page-id>
npm run test:song -- <browser-page-id> '<本地歌曲路径>'
```

浏览器检查还覆盖默认英语、中英切换、语言记忆、错误提示和播放中切换时的状态保留。它实际拖入 `public/demo.mp3`，把导出的 MIDI 与 `tests/demo-notes.json` 的 53 个参考音符比较，并检查跨块识别、钢琴音频信号、播放 / 暂停、跳转、原音、取消、损坏文件和静音。还检查示例下载失败与取消，以及《月光》完整第一乐章和《致爱丽丝》的转谱和播放。会重载指定测试页面。

简谱检查覆盖换调后的发声、黑键快捷键、八度点、换调释放按住的音符、输入焦点、偏好记忆，以及 MIDI 和播放状态保留。

`test:song` 通过浏览器上传指定的真实歌曲，检查取消后模型进程退出、重新导入、完整转谱、两个单音轨道以及钢琴音频信号。它验证运行链路；音乐还原度仍需要与原音试听比较，不能由音符数量或信号非零证明。

## 示例曲目

在上传区旁选择曲目，点击「听听一段示例」。示例与导入音频使用相同的纯乐器转谱、钢琴重奏、原音对照及 MIDI 导出流程。

- **雨后**：原创短曲，可通过 `python3 scripts/make-demo.py` 重新生成（需要 FFmpeg）。
- **月光奏鸣曲 · 第一乐章 — 贝多芬**：约 5 分 7 秒的完整第一乐章，使用公有领域的 Mutopia MIDI 合成音频。整曲转谱需要更长时间，详见[音源与许可](public/demos/README.md)。
- **致爱丽丝 — 贝多芬**：约 2 分 57 秒的完整钢琴演奏，由 V. Gao 演奏并以 CC0 发布，详见[音源与许可](public/demos/README.md)。

## 来源

- 交互参考：[Brandenburg Piano](https://brandenburg-piano.vercel.app/)。
- 转谱模型：[Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts)，Apache-2.0。
- 歌曲分离：[Demucs](https://github.com/facebookresearch/demucs)，MIT；音高追踪：[torchcrepe](https://github.com/maxrmorrison/torchcrepe)，MIT。
- 钢琴采样：Alexander Holm 的 Salamander Grand Piano，CC BY 3.0；来源与许可见 [public/piano/README.txt](public/piano/README.txt)。
