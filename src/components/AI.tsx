import './AI.css'
import { useEffect, useState } from 'preact/hooks'
import ChatBox, { type Chat } from './ChatBox'
import type { RoleScopedChatInput } from '../lib/chatbot-utils'
import { marked } from 'marked'



const AUTH_ANSWER = import.meta.env.PUBLIC_AUTH_ANSWER


export default function AI() {
  const [authAnswer, setAuthAnswer] = useState('')
  const [error, setError] = useState('')
  const [auth, setAuth] = useState(false)
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!question) return;

    const assistantMsg: RoleScopedChatInput = { role: "assistant", content: "" };
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/event-stream',
        },
        body: JSON.stringify(
          {
            "role": "user",
            "content": question
          }
        )
      })

      if (res.body) {
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();

        while (true) {
          const { value, done } = await reader.read()
          if (value) {
            assistantMsg.content += value;
          }

          setChats([...chats, { question, answer: marked.parse(assistantMsg.content) as string }])

          if (done) {
            setAsked(true)
            setQuestion('')
            setError('')
            break;
          }
        }
      }


    } catch (err) {
      if (err) {
        setError(err.message)
        setAsked(true)
        setQuestion('')
      }
    }





  }

  useEffect(() => {
    console.log('default:', AUTH_ANSWER)
  }, [])

  return (
    <div className='question-container'>
      <form onSubmit={handleSubmit}
        id='answer-form'
      >
        {auth ?
          <div className='input-container'>
            {!asked ? <h3>有什么想问AI的吗？</h3>
              :
              <ChatBox
                chats={chats}
                error={error}
              />}
            <div className={asked ? 'question-input asked' : 'question-input'}>
              <input
                type="text"
                name="question"
                id="question"
                multiple
                value={question}
                onInput={e => setQuestion((e.currentTarget as HTMLInputElement).value)}
                placeholder="询问AI"
                required
              />
              <button id="submit-btn"
                type='submit'
                form='answer-form'>
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.8" d="M12 4v16m5-11s-3.682-5-5-5s-5 5-5 5" ></path></svg>
              </button>
            </div>
          </div>
          :
          <div className='overlay'>
            <div className='auth-container'>
              <label htmlFor='auth'>我近期最喜欢的德国作家是?
              </label>
              <input id="auth"
                value={authAnswer}
                type="text"
                name="auth"
                onInput={e => setAuthAnswer((e.currentTarget as HTMLInputElement).value)}
              />
              <button
                type='button'
                id="auth-btn"
                onClick={e => {
                  e.preventDefault();
                  console.log(authAnswer)
                  setAuth(authAnswer === AUTH_ANSWER)
                }}

              >验证</button>
            </div>
          </div>}
      </form>
    </div>
  )
}
