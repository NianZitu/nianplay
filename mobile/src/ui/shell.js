// App-wide UI actions (navigation, menus, toasts), provided by AppShell.
import { createContext, useContext } from 'react'

export const ShellContext = createContext(null)
export const useShell = () => useContext(ShellContext)
