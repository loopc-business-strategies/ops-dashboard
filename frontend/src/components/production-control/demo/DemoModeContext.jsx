import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const DemoModeContext = createContext({
  isDemo: false,
  enterDemo: () => {},
  exitDemo: () => {},
})

export function DemoModeProvider({ children }) {
  const [isDemo, setIsDemo] = useState(false)

  const enterDemo = useCallback(() => setIsDemo(true), [])
  const exitDemo = useCallback(() => setIsDemo(false), [])

  const value = useMemo(() => ({ isDemo, enterDemo, exitDemo }), [isDemo, enterDemo, exitDemo])

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoModeContext)
}
