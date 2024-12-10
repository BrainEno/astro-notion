import { marked } from 'marked'
import { useEffect, useRef } from 'preact/hooks';
import CopyButton from './CopyButton';

export type Chat = {
    question: string;
    answer: string;
}

const ChatBox = ({ chats, error }: { chats: Chat[], error: string }) => {
    const answerRef = useRef(null)
    useEffect(() => {
        answerRef.current.scrollIntoView({ behavior: 'smooth' })
    }, [chats])

    return (
        <div className='chat-box-container' >
            {
                chats.map(chat => (

                    <div className='chat-box'>
                        <div className='chat-question'>{chat.question}</div>
                        <div
                            ref={answerRef}
                            className={chat.answer ? 'chat-answer' : 'empty'}>
                            {!!error ? <div>{error}</div> : <div dangerouslySetInnerHTML={{ __html: chat.answer }}></div>
                            }
                            <CopyButton
                                text={chat.answer}
                            />
                        </div>
                    </div>
                ))}
        </div>
    )
}

export default ChatBox
