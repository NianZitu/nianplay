// App-wide UI actions (navigation, menus, toasts), provided by AppShell.
import { createContext, useContext, useEffect, useRef } from 'react'

export const ShellContext = createContext(null)
export const useShell = () => useContext(ShellContext)

// Android back button: the most recently opened overlay (sheet, full-screen player) closes first;
// with none open, the Shell goes back a page / to Início / minimizes the app.
const backHandlers = []

export function useBackHandler(onBack, enabled = true) {
  const ref = useRef(onBack)
  ref.current = onBack
  useEffect(() => {
    if (!enabled) return
    const entry = () => ref.current?.()
    backHandlers.push(entry)
    return () => {
      const i = backHandlers.lastIndexOf(entry)
      if (i !== -1) backHandlers.splice(i, 1)
    }
  }, [enabled])
}

/** Runs the top overlay's handler; false when there is no overlay open. */
export function runBackHandler() {
  const top = backHandlers[backHandlers.length - 1]
  if (!top) return false
  top()
  return true
}
