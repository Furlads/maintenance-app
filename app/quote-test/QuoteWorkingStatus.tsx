'use client'

import { useEffect } from 'react'

const MESSAGES = [
  'Looking through the job details…',
  'Checking the measurements and scope…',
  'Reviewing the site photos…',
  'Working through materials and labour…',
  'Checking the pricing against Furlads rates…',
  'Making sure the options stack up…',
  'Nearly there — putting the quote together…',
]

export default function QuoteWorkingStatus() {
  useEffect(() => {
    let timer: number | null = null
    let index = 0
    let activeTarget: HTMLElement | null = null

    function stop() {
      if (timer) window.clearInterval(timer)
      timer = null
      index = 0
      activeTarget = null
    }

    function findWorkingBubble() {
      return Array.from(document.querySelectorAll<HTMLElement>('div')).find((element) =>
        element.children.length === 0 &&
        (element.textContent || '').trim() === 'I’m working that quote out…'
      ) || null
    }

    function start(target: HTMLElement) {
      if (activeTarget === target && timer) return

      stop()
      activeTarget = target
      target.textContent = MESSAGES[0]
      index = 1

      timer = window.setInterval(() => {
        if (!activeTarget || !document.body.contains(activeTarget)) {
          stop()
          return
        }

        activeTarget.textContent = MESSAGES[index % MESSAGES.length]
        index += 1
      }, 2200)
    }

    function scan() {
      // Once we have taken over the busy bubble, our own changing text means it
      // no longer matches the original React copy. Keep the timer alive until
      // React actually removes that bubble when the quote result arrives.
      if (activeTarget && document.body.contains(activeTarget)) {
        return
      }

      if (activeTarget && !document.body.contains(activeTarget)) {
        stop()
      }

      const target = findWorkingBubble()
      if (target) start(target)
    }

    const observer = new MutationObserver(scan)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    scan()

    return () => {
      observer.disconnect()
      stop()
    }
  }, [])

  return null
}
