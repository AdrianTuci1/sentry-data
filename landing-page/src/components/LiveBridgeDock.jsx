import { useEffect, useMemo, useRef, useState } from 'react'
import { clamp, mix, rangeProgress } from './LiveInsightsBridge.model'
import { ArrowUpIcon, MicIcon, XIcon } from './LiveBridgeDockIcons'
import { liveInsightsBridgeContent } from '../content/homePageContent'
import { useLiveInsightsBridgeStore } from './LiveInsightsBridgeStore'

const CHAT_VARIANTS = Object.fromEntries(
  liveInsightsBridgeContent.domains.map((domain) => [
    domain.label,
    {
      prompt: domain.prompt,
      response: domain.response,
    },
  ]),
)

export function LiveBridgeDock({ progress, retreatProgress = 0, collapseProgress }) {
  const { displayedDomain } = useLiveInsightsBridgeStore()
  const domainLabel = displayedDomain.label
  const clampedProgress = clamp(progress, 0, 1)
  const clampedRetreat = clamp(retreatProgress, 0, 1)
  const buttonsProgress = rangeProgress(clampedProgress, 0, 0.26)
  const expandProgress = rangeProgress(clampedProgress, 0.18, 0.56)
  const composerProgress = rangeProgress(clampedProgress, 0.22, 0.7)
  const chatWindowProgress = rangeProgress(clampedProgress, 0.42, 0.92)
  const shellWidth = mix(220, 520, expandProgress)
  const [lockedDomain, setLockedDomain] = useState(domainLabel)
  const [typedPromptLength, setTypedPromptLength] = useState(0)
  const [typedResponseLength, setTypedResponseLength] = useState(0)
  const [messageSent, setMessageSent] = useState(false)
  const [responseReady, setResponseReady] = useState(false)
  const transitionLockedRef = useRef(false)
  const promptStartRef = useRef(false)
  const sendStartRef = useRef(false)
  const responseStartRef = useRef(false)
  const dockContent = liveInsightsBridgeContent.dock
  const scenario = useMemo(
    () => CHAT_VARIANTS[lockedDomain] || CHAT_VARIANTS[liveInsightsBridgeContent.domains[0].label],
    [lockedDomain],
  )

  useEffect(() => {
    if (clampedProgress < 0.04) {
      transitionLockedRef.current = false
      promptStartRef.current = false
      sendStartRef.current = false
      responseStartRef.current = false
      setLockedDomain(domainLabel)
      setTypedPromptLength(0)
      setTypedResponseLength(0)
      setMessageSent(false)
      setResponseReady(false)
      return
    }

    if (clampedProgress >= 0.18 && !transitionLockedRef.current) {
      transitionLockedRef.current = true
      promptStartRef.current = false
      sendStartRef.current = false
      responseStartRef.current = false
      setLockedDomain(domainLabel)
      setTypedPromptLength(0)
      setTypedResponseLength(0)
      setMessageSent(false)
      setResponseReady(false)
    }
  }, [clampedProgress, domainLabel])

  useEffect(() => {
    if (!transitionLockedRef.current || composerProgress < 0.12) {
      return undefined
    }

    promptStartRef.current = true

    if (typedPromptLength >= scenario.prompt.length) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setTypedPromptLength((currentLength) => currentLength + 1)
    }, 22)

    return () => window.clearTimeout(timeoutId)
  }, [composerProgress, scenario.prompt, typedPromptLength])

  useEffect(() => {
    if (
      !promptStartRef.current ||
      typedPromptLength < scenario.prompt.length ||
      messageSent ||
      sendStartRef.current
    ) {
      return undefined
    }

    sendStartRef.current = true

    const timeoutId = window.setTimeout(() => {
      setMessageSent(true)
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [messageSent, scenario.prompt.length, typedPromptLength])

  useEffect(() => {
    if (!messageSent || responseReady || responseStartRef.current) {
      return undefined
    }

    responseStartRef.current = true

    const timeoutId = window.setTimeout(() => {
      setResponseReady(true)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [messageSent, responseReady])

  useEffect(() => {
    if (!responseReady || chatWindowProgress < 0.08) {
      return undefined
    }

    if (typedResponseLength >= scenario.response.length) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setTypedResponseLength((currentLength) => currentLength + 1)
    }, 18)

    return () => window.clearTimeout(timeoutId)
  }, [chatWindowProgress, responseReady, scenario.response, typedResponseLength])

  const inputValue = messageSent ? '' : scenario.prompt.slice(0, typedPromptLength)
  const sendReady = typedPromptLength >= scenario.prompt.length && !messageSent
  const showUserMessage = messageSent
  const showAiMessage = responseReady || typedResponseLength > 0
  const retreatOpacity = clamp(1 - clampedRetreat * 1.2, 0, 1)
  const chatRetreatOpacity = clamp(1 - clampedRetreat * 1.6, 0, 1)
  const composerRetreatOpacity = clamp(1 - clampedRetreat * 1.1, 0, 1)

  return (
    <div
      className="live-bridge-dock"
      style={{
        opacity: clampedProgress * retreatOpacity * (1 - collapseProgress * 0.75),
        transform: `translate3d(0, ${
          mix(28, 0, buttonsProgress) + clampedRetreat * 26 + collapseProgress * 42
        }px, 0) scale(${mix(mix(0.96, 1, buttonsProgress), 0.94, clampedRetreat)})`,
      }}
    >
      <div
        className="live-bridge-chat-window"
        style={{
          opacity: chatWindowProgress * chatRetreatOpacity,
          transform: `translate3d(-50%, ${
            mix(20, 0, chatWindowProgress) + clampedRetreat * 28
          }px, 0) scale(${mix(mix(0.94, 1, chatWindowProgress), 0.9, clampedRetreat)})`,
        }}
      >
        <div className="live-bridge-chat-window-header">
          <span className="live-bridge-chat-status"></span>
          <span>{dockContent.assistantLabel}</span>
          <span className="live-bridge-chat-window-domain">{lockedDomain}</span>
        </div>

        <div className="live-bridge-chat-thread">
          {showUserMessage && (
            <article className="live-bridge-chat-line live-bridge-chat-line-right live-bridge-chat-line-user">
              <p>{scenario.prompt}</p>
            </article>
          )}

          {showAiMessage && (
            <article className="live-bridge-chat-line live-bridge-chat-line-left live-bridge-chat-line-ai">
              <div className="live-bridge-chat-line-meta">
                <span>{dockContent.aiSystemLabel}</span>
                <span>{dockContent.liveContextLabel}</span>
              </div>
              <p>{scenario.response.slice(0, typedResponseLength)}</p>
            </article>
          )}
        </div>
      </div>

      <div
        className="live-bridge-dock-shell"
        style={{
          width: `min(100%, ${shellWidth}px)`,
        }}
      >
        <div
          className={`live-bridge-dock-composer ${messageSent ? 'is-sent' : ''}`}
          style={{
            opacity: composerProgress * composerRetreatOpacity,
            transform: `translate3d(0, ${
              mix(8, 0, composerProgress) + clampedRetreat * 12
            }px, 0) scale(${mix(mix(0.96, 1, composerProgress), 0.94, clampedRetreat)})`,
          }}
        >
          <button
            className="live-bridge-dock-chat-close-btn"
            type="button"
            aria-label={dockContent.closeChatAriaLabel}
          >
            <XIcon size={15} />
          </button>

          <input
            className="live-bridge-dock-chat-input"
            type="text"
            value={inputValue}
            placeholder={messageSent ? '' : dockContent.inputPlaceholder}
            readOnly
            aria-label={dockContent.inputAriaLabel}
          />

          <button
            className="live-bridge-dock-chat-mic-btn"
            type="button"
            aria-label={dockContent.voiceInputAriaLabel}
          >
            <MicIcon size={15} />
          </button>

          <button
            className={`live-bridge-dock-chat-send-btn ${sendReady ? 'is-ready' : ''} ${
              messageSent ? 'is-sent' : ''
            }`}
            type="button"
            aria-label={dockContent.sendMessageAriaLabel}
          >
            <ArrowUpIcon size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
