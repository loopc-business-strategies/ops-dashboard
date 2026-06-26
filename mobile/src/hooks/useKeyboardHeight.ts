import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

export function useKeyboardHeight(enabled = true): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setKeyboardHeight(0)
      return
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      setKeyboardHeight(Number(e?.endCoordinates?.height || 0))
    }
    const onHide = () => setKeyboardHeight(0)

    const subShow = Keyboard.addListener(showEvent, onShow)
    const subHide = Keyboard.addListener(hideEvent, onHide)

    return () => {
      subShow.remove()
      subHide.remove()
    }
  }, [enabled])

  return keyboardHeight
}
