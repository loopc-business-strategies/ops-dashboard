import React from 'react'
import { vi } from 'vitest'

;(globalThis as { __DEV__?: boolean }).__DEV__ = false

function mockComponent(name: string) {
  const Comp = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(name, props, children)
  Comp.displayName = name
  return Comp
}

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    flatten: (style: unknown) => style,
  },
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  Pressable: mockComponent('Pressable'),
  ScrollView: mockComponent('ScrollView'),
  TextInput: mockComponent('TextInput'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  Image: mockComponent('Image'),
  Switch: mockComponent('Switch'),
  useColorScheme: () => 'light',
}))
