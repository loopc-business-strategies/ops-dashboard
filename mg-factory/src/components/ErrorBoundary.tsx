import React from 'react'
import { StyleSheet, Text, View, Pressable } from 'react-native'
import { colors } from '@/src/theme'
import { API_URL } from '@/src/config/env'

type Props = { children: React.ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[MG Factory] uncaught render error', error)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      let apiHost = 'not configured'
      try {
        apiHost = new URL(API_URL).host
      } catch {
        // ignore
      }
      return (
        <View style={styles.wrap}>
          <Text style={styles.brand}>MG Factory</Text>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.body}>{this.state.error.message || 'Unexpected error'}</Text>
          <Text style={styles.meta}>Connection: {apiHost}</Text>
          <Pressable style={styles.btn} onPress={this.reset} accessibilityRole="button">
            <Text style={styles.btnText}>Retry</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  brand: { color: colors.accent, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  meta: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
})
