<template>
  <div class="app-container">
    <!-- 顶部栏 -->
    <header>
      <div class="title">AI群聊助手</div>
      <div class="actions">
        <select v-model="currentSessionId" @change="loadMessages">
          <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button @click="archiveAndNew">+ 新建封存</button>
      </div>
    </header>

    <!-- 聊天区域 -->
    <main ref="chatBox">
      <div v-for="msg in messages" :key="msg.id" class="message-row" :class="{ 'my-msg': msg.user_id === myUserId }">
        <div class="avatar" :style="{ background: msg.is_ai ? '#10a37f' : stringToColor(msg.user_id) }">
          {{ msg.is_ai ? 'AI' : msg.user_name[0] }}
        </div>
        <div class="content-wrapper">
          <div class="name">{{ msg.is_ai ? 'AI助手' : msg.user_name }}</div>
          <div class="bubble" v-html="renderMarkdown(msg.content)"></div>
        </div>
      </div>
    </main>

    <!-- 底部输入框 -->
    <footer>
      <input 
        v-model="inputText" 
        @keyup.enter="sendMessage" 
        placeholder="输入消息，所有人可见..." 
        :disabled="isAiThinking"
      />
      <button @click="sendMessage" :disabled="isAiThinking">发送</button>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'

// ================= 配置区域 (请替换为你自己的) =================
// ⚠️注意：真实项目中建议通过后端转发API Key，纯前端有暴露Key的风险
const SUPABASE_URL = 'https://lwqasyywcadyvimefwsl.supabase.co' 
const SUPABASE_KEY = 'sb_secret_Xyop-v5JaPTSNLM2Vzm8Og_VbJugs4Z'
const AI_API_URL = 'https://aistudio.alibaba-inc.com/api/aiapp/run/AGAYyUetSdv/1.0.0' // 或其他中转地址
const AI_API_KEY = '32330c11f4aee35408925d96aea3857c' 
// ===========================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 状态变量
const myUserId = ref('')
const myUserName = ref('')
const sessions = ref([])
const currentSessionId = ref(null)
const messages = ref([])
const inputText = ref('')
const chatBox = ref(null)
const isAiThinking = ref(false)

// 1. 初始化身份
const initIdentity = () => {
  let storedId = localStorage.getItem('chat_user_id')
  let storedName = localStorage.getItem('chat_user_name')
  
  if (!storedId) {
    storedId = Math.random().toString(36).substr(2, 9)
    storedName = prompt("请输入你的昵称：") || `用户${storedId.substr(0,4)}`
    localStorage.setItem('chat_user_id', storedId)
    localStorage.setItem('chat_user_name', storedName)
  }
  
  myUserId.value = storedId
  myUserName.value = storedName
}

// 2. 加载会话列表
const loadSessions = async () => {
  const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false })
  if (data && data.length > 0) {
    sessions.value = data
    // 如果没有选定会话，默认选最新的
    if (!currentSessionId.value) {
      currentSessionId.value = data[0].id
      loadMessages()
      subscribeToRealtime()
    }
  }
}

// 3. 加载历史记录
const loadMessages = async () => {
  if (!currentSessionId.value) return
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', currentSessionId.value)
    .order('created_at', { ascending: true })
  
  if (data) {
    messages.value = data
    scrollToBottom()
  }
}

// 4. 实时订阅 (核心功能：接收别人的消息)
const subscribeToRealtime = () => {
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      // 只接收当前会话的消息
      if (payload.new.session_id === currentSessionId.value) {
        // 如果消息已经在列表中（比如是自己发的），就不重复添加
        if (!messages.value.find(m => m.id === payload.new.id)) {
          messages.value.push(payload.new)
          scrollToBottom()
        }
      }
    })
    .subscribe()
}

// 5. 发送消息
const sendMessage = async () => {
  if (!inputText.value.trim()) return
  const content = inputText.value
  inputText.value = ''

  // 写入数据库
  const { error } = await supabase.from('messages').insert({
    session_id: currentSessionId.value,
    user_id: myUserId.value,
    user_name: myUserName.value,
    content: content,
    is_ai: false
  })

  if (error) {
    alert('发送失败')
    return
  }
  
  // 触发 AI 回复逻辑 (这里设定简单的规则：如果包含"AI"或者直接对话)
  // 为了简化，假设每句话都发给AI，或者你可以加一个 checkbox 决定是否问AI
  // 这里演示：发送消息后自动触发 AI
  await askAI(content)
}

// 6. 请求 AI 接口
const askAI = async (userQuestion) => {
  isAiThinking.value = true
  
  try {
    // 构建上下文 (带上最近几条历史记录)
    const history = messages.value.slice(-5).map(m => ({
      role: m.is_ai ? 'assistant' : 'user',
      content: `${m.user_name}: ${m.content}`
    }))

    // 模拟 API 调用，请替换为真实的 fetch
    // const response = await fetch(AI_API_URL, { ... })
    
    // --- ⚠️ 这里是模拟代码，因为我没有你的API文档 ---
    // 实际开发请解开下面注释并适配你的接口文档
    /*
    const res = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "你是一个群聊助手，简短回答。" },
                ...history,
                { role: "user", content: userQuestion }
            ]
        })
    })
    const data = await res.json()
    const aiText = data.choices[0].message.content
    */
    
    // 模拟延迟和回复
    await new Promise(r => setTimeout(r, 1000)) 
    const aiText = `(模拟AI回复) 我收到了你的问题：${userQuestion}。请在代码中配置真实的 API Key。`
    // -------------------------------------------

    // 将 AI 回复写入数据库
    await supabase.from('messages').insert({
      session_id: currentSessionId.value,
      user_id: 'ai_bot',
      user_name: 'AI助手',
      content: aiText,
      is_ai: true
    })

  } catch (e) {
    console.error(e)
  } finally {
    isAiThinking.value = false
  }
}

// 7. 封存并新建会话
const archiveAndNew = async () => {
  const name = prompt("请输入新聊天的名称：", `聊天 ${new Date().toLocaleString()}`)
  if (!name) return

  const { data, error } = await supabase
    .from('sessions')
    .insert({ name: name })
    .select()
  
  if (data) {
    sessions.value.unshift(data[0])
    currentSessionId.value = data[0].id
    messages.value = [] // 清空当前视图
  }
}

// 辅助：头像颜色
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 70%, 60%)`;
}

// 辅助：Markdown渲染
const renderMarkdown = (text) => {
  return marked.parse(text || '')
}

// 辅助：滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight
  })
}

onMounted(() => {
  initIdentity()
  loadSessions()
})
</script>

<style scoped>
.app-container { display: flex; flex-direction: column; height: 100vh; max-width: 600px; margin: 0 auto; background: #f5f5f5; font-family: sans-serif; }
header { background: #fff; padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
header .title { font-weight: bold; }
main { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
.message-row { display: flex; gap: 10px; align-items: flex-start; }
.message-row.my-msg { flex-direction: row-reverse; }
.avatar { width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; flex-shrink: 0; }
.content-wrapper { display: flex; flex-direction: column; max-width: 70%; }
.my-msg .content-wrapper { align-items: flex-end; }
.name { font-size: 12px; color: #888; margin-bottom: 2px; }
.bubble { background: #fff; padding: 8px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); word-break: break-all; line-height: 1.5; }
.my-msg .bubble { background: #95ec69; }
footer { padding: 10px; background: #fff; border-top: 1px solid #ddd; display: flex; gap: 10px; }
input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
button { padding: 0 20px; background: #007bff; color: #fff; border: none; border-radius: 20px; cursor: pointer; }
button:disabled { background: #ccc; }
</style>
