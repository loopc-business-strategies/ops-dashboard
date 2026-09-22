import React from 'react'
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'

const logoSource = require('../../assets/branding/modern-gold-logo.png')

type Props = {
  height?: number
  style?: StyleProp<ViewStyle>
  imageStyle?: StyleProp<ImageStyle>
}

/** Official Modern Gold mark — contain, never stretch. */
export function ModernGoldLogo({ height = 56, style, imageStyle }: Props) {
  const width = Math.round(height * 2.4)
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={logoSource}
        accessibilityLabel="Modern Gold"
        resizeMode="contain"
        style={[{ width, height }, imageStyle]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
})
