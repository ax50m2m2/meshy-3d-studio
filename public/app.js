const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { mode: "text", tasks: [], activeModel: null, polling: new Set() };
const STORAGE_KEY = "meshy-studio-tasks-v1";

function notice(message, type = "") {
  const el = $("#notice");
  el.textContent = message;
  el.className = "notice" + (type ? " " + type : "");
}
function loadTasks() {
  try { state.tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { state.tasks = []; }
  renderTasks();
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks.slice(0, 20))); } catch {}
}
function renderTasks() {
  const root = $("#taskList");
  if (!state.tasks.length) {
    root.innerHTML = '<div class="empty-mini"><span>◷</span><p>尚无生成任务</p><small>提交一次生成请求后，进度会显示在这里。</small></div>';
    return;
  }
  root.innerHTML = state.tasks.map(t => `<div class="task-card"><div class="task-title">${escapeHtml(t.prompt || t.id)}</div><div class="task-sub"><span>${escapeHtml(t.id || "等待任务 ID")}</span><span class="task-state">${escapeHtml(t.status || "PENDING")}</span></div>${t.error ? `<div class="task-error">${escapeHtml(t.error)}</div>` : ""}<div class="task-sub"><span>${escapeHtml(t.mode === "image" ? "图片生成" : "文字生成")}</span><button class="text-btn" data-open="${escapeHtml(t.id || "")}" type="button">查看任务 ↗</button></div></div>`).join("");
  $$("[data-open]").forEach(btn => btn.addEventListener("click", () => {
    const task = state.tasks.find(t => t.id === btn.dataset.open);
    if (task) { if (task.modelUrl) showModel(task); else pollTask(task); }
  }));
}
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
async function api(path, options = {}) {
  const res = await fetch("/api/meshy" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `请求失败（HTTP ${res.status}）`);
  return data;
}
function setMode(mode) {
  state.mode = mode;
  $$(".mode").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  $("#imageField").classList.toggle("hidden", mode !== "image");
  $("#prompt").placeholder = mode === "image"
    ? "补充描述（可选）：例如，保留参考图片的整体轮廓，生成干净的游戏资产。"
    : "例如：一座中国古代烽火台，灰色砖石结构，木制瞭望平台，游戏道具，干净的三维资产……";
  $("#prompt").required = mode === "text";
}
function getModelUrl(data) {
  return data?.model_urls?.glb || data?.model_urls?.glb_url || data?.model_url || null;
}
function showModel(task) {
  if (!task.modelUrl) return;
  state.activeModel = task;
  $("#placeholder").classList.add("hidden");
  $("#modelViewer").classList.remove("hidden");
  $("#modelViewer").src = task.modelUrl;
  $("#downloadBtn").disabled = false;
  $("#modelName").textContent = (task.prompt || "AI 生成模型").slice(0, 40);
  $("#modelFormat").textContent = "GLB";
  $("#modelState").textContent = task.status || "SUCCEEDED";
  notice("模型已加载。可拖拽旋转、滚轮缩放，或下载 GLB 文件。", "success");
}
async function submitTask(event) {
  event.preventDefault();
  const prompt = $("#prompt").value.trim();
  const imageUrl = $("#imageUrl").value.trim();
  if (state.mode === "text" && !prompt) return notice("请先输入模型描述。", "error");
  if (state.mode === "image" && !imageUrl) return notice("请填写可公开访问的参考图片 URL。", "error");
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.innerHTML = "正在提交请求…";
  notice("正在向 Meshy 提交任务，请稍候。");
  try {
    let data;
    if (state.mode === "image") {
      data = await api("/image-to-3d", { method: "POST", body: JSON.stringify({
        image_url: imageUrl,
        ...(prompt ? { prompt } : {}),
        ai_model: "latest",
        should_remesh: true,
        should_texture: true
      })});
    } else {
      const quality = $("#quality").value;
      data = await api("/text-to-3d", { method: "POST", body: JSON.stringify({
        mode: quality === "refine" ? "refine" : "preview",
        prompt,
        art_style: $("#style").value.trim(),
        should_remesh: true,
        topology: "triangle",
        target_polycount: 30000
      })});
    }
    const id = data.result || data.task_id || data.id;
    if (!id) throw new Error("服务返回中没有任务 ID：" + JSON.stringify(data));
    const task = { id, prompt: prompt || "图片转 3D", mode: state.mode, status: data.status || "PENDING", createdAt: Date.now(), modelUrl: getModelUrl(data) };
    state.tasks.unshift(task);
    saveTasks(); renderTasks();
    $("#modelName").textContent = task.prompt.slice(0, 40);
    $("#modelState").textContent = task.status;
    notice("任务已提交，正在等待模型生成。生成耗时取决于模型复杂度和服务端队列。");
    if (task.modelUrl) showModel(task); else pollTask(task);
  } catch (error) {
    notice(error.message || "提交失败，请检查 API 配置。", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>✦</span> 开始生成模型 <span class="arrow">↗</span>';
  }
}
async function pollTask(task) {
  if (!task?.id || state.polling.has(task.id)) return;
  state.polling.add(task.id);
  const endpoint = task.mode === "image" ? "/image-to-3d/" : "/text-to-3d/";
  const terminal = new Set(["SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"]);
  let attempts = 0;
  try {
    while (attempts++ < 120) {
      const data = await api(endpoint + encodeURIComponent(task.id));
      task.status = data.status || task.status;
      task.progress = data.progress;
      task.error = data.task_error?.message || data.error || null;
      task.modelUrl = getModelUrl(data) || task.modelUrl;
      saveTasks(); renderTasks();
      $("#modelState").textContent = task.status + (Number.isFinite(data.progress) ? " · " + data.progress + "%" : "");
      if (task.modelUrl) showModel(task);
      if (terminal.has(task.status)) {
        if (task.status === "SUCCEEDED") {
          if (task.modelUrl) showModel(task);
          notice(task.modelUrl ? "模型生成成功。" : "任务成功，但响应中没有 GLB 下载地址。请检查 Meshy API 返回字段。", task.modelUrl ? "success" : "error");
        } else notice("任务结束：" + task.status + (task.error ? " — " + task.error : ""), "error");
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (attempts >= 120 && !terminal.has(task.status)) notice("任务仍在处理中。可稍后点击任务卡片继续查看。");
  } catch (error) {
    task.error = error.message;
    saveTasks(); renderTasks();
    notice("无法查询任务进度：" + error.message, "error");
  } finally { state.polling.delete(task.id); }
}
async function checkHealth() {
  try {
    const r = await fetch("/api/health");
    const data = await r.json();
    $("#healthDot").style.background = data.configured ? "#8be0bb" : "#e2b36c";
    $("#healthText").textContent = data.configured ? "服务已配置" : "等待配置 API Key";
    if (!data.configured) notice("服务已启动，但还未配置 MESHY_API_KEY。请在服务器环境变量中设置后重启服务。");
  } catch {
    $("#healthText").textContent = "服务连接失败";
    $("#healthDot").style.background = "#ef8585";
    notice("无法连接后端服务，请确认 Node.js 服务已启动。", "error");
  }
}
$$(".mode").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
$$(".example").forEach(b => b.addEventListener("click", () => {
  $("#prompt").value = ({
    "低多边形小屋":"低多边形风格的森林小屋，木质墙壁，石头烟囱，倾斜屋顶，独立游戏资产，干净拓扑。",
    "中国古代战船":"中国古代木制战船，深色木板船体，船帆与桅杆，历史题材游戏资产，完整三维结构。",
    "科幻机器人":"未来科幻探索机器人，机械关节，金属外壳，精细工业设计，站立姿态，游戏用三维资产。"
  })[b.textContent] || "";
}));
$("#createForm").addEventListener("submit", submitTask);
$("#clearBtn").addEventListener("click", () => { state.tasks = []; saveTasks(); renderTasks(); notice("本地任务记录已清除。"); });
$("#resetView").addEventListener("click", () => { const viewer = $("#modelViewer"); viewer.cameraOrbit = "auto auto auto"; viewer.fieldOfView = "auto"; viewer.jumpCameraToGoal(); });
$("#downloadBtn").addEventListener("click", () => {
  if (state.activeModel?.modelUrl) window.open(state.activeModel.modelUrl, "_blank", "noopener,noreferrer");
});
$("#historyNav").addEventListener("click", () => $("#taskList").scrollIntoView({ behavior: "smooth", block: "center" }));
loadTasks();
checkHealth();
