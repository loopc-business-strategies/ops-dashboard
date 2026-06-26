import { View } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'

export type DonutSegment = {
  value: number
  color: string
  label: string
}

type DonutChartProps = {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
}

export default function DonutChart({
  segments,
  size = 180,
  strokeWidth = 22,
  centerLabel,
}: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  if (total <= 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
      </View>
    )
  }

  let offset = 0
  const arcs = segments.map((seg) => {
    const pct = seg.value / total
    const dash = circumference * pct
    const arc = { ...seg, dash, gap: circumference - dash, offset: -offset }
    offset += dash
    return arc
  })

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {arcs.map((arc, i) => (
            <Circle
              key={`${arc.label}-${i}`}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      {centerLabel ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: strokeWidth + 8,
          }}
          pointerEvents="none"
        >
          {/* center label rendered by parent if needed */}
        </View>
      ) : null}
    </View>
  )
}

export function donutSegmentColors(primary: string): string[] {
  return [primary, '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6B7280']
}
