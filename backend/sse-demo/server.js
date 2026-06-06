const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()
app.use(cors())
app.use(bodyParser.json())

let clients = []

function broadcast(data) {
  const s = `data: ${JSON.stringify(data)}\n\n`
  clients.forEach((res) => {
    try { res.write(s) } catch (e) {}
  })
}

app.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
  res.flushHeaders && res.flushHeaders()
  clients.push(res)
  const clientId = Date.now() + Math.random()
  console.log('SSE client connected', clientId)
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`)

  req.on('close', () => {
    console.log('SSE client disconnected', clientId)
    clients = clients.filter(c => c !== res)
  })
})

app.post('/send', (req, res) => {
  const { role, message } = req.body || {}
  console.log('Received message:', role, message)
  const reply = `已收到：${message}。这是来自 SSE 模拟的流式回复。`
  const chunks = reply.match(/.{1,12}/gs) || [reply]
  let i = 0
  const timer = setInterval(() => {
    if (i < chunks.length) {
      broadcast({ type: 'message', role: 'assistant', partial: true, content: chunks[i] })
      i++
    } else {
      broadcast({ type: 'message', role: 'assistant', partial: false, content: '', done: true })
      clearInterval(timer)
    }
  }, 250)

  res.json({ ok: true })
})

app.get('/', (req, res) => res.send('SSE demo server'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`SSE demo server listening on ${PORT}`))
