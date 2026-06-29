import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import { SymbolView } from 'expo-symbols'
import { attachmentRequestUrl, getAuthToken } from '@/src/api/client'
import { useChat } from '@/src/context/ChatContext'
import { useAuth } from '@/src/context/AuthContext'
import { useTenant } from '@/src/context/TenantContext'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import type { ChatAttachment } from '@/src/types/chat'
import { formatAttachmentSize } from '@/src/utils/chat'
import { fmtTime } from '@/src/utils/format'

function AttachmentBubble({
  attachment,
  mine,
  styles,
}: {
  attachment: ChatAttachment
  mine: boolean
  styles: ReturnType<typeof createChatDetailStyles>
}) {
  const token = getAuthToken()
  const { companyCode } = useTenant()
  const url = attachment.fileName ? attachmentRequestUrl(attachment.fileName) : ''
  const label = attachment.originalName || attachment.fileName || 'Attachment'
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'x-tenant': companyCode,
    'x-company': companyCode,
    'X-Client': 'mobile',
  }

  if (attachment.kind === 'image' && url && token) {
    return (
      <Image
        source={{ uri: url, headers: authHeaders }}
        style={styles.imageAttachment}
        resizeMode="cover"
      />
    )
  }

  return (
    <Pressable
      style={[styles.fileAttachment, mine && styles.fileAttachmentMine]}
      onPress={() => {
        if (url) Linking.openURL(url).catch(() => undefined)
      }}
    >
      <Text style={[styles.fileAttachmentLabel, mine && styles.fileAttachmentLabelMine]} numberOfLines={+2}>
        📎 {label}
      </Text>
      {attachment.size ? (
        <Text style={[styles.fileAttachmentMeta, mine && styles.fileAttachmentLabelMine]}>
          {formatAttachmentSize(attachment.size)}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets()
  const { branding } = useTenant()
  const styles = useMemo(() => createChatDetailStyles(branding), [branding])
  const { chatId: rawChatId } = useLocalSearchParams<{ chatId: string }>()
  const chatId = decodeURIComponent(String(rawChatId || ''))
  const { user } = useAuth()
  const { getConversation, markRead, sendMessage, sendAttachment } = useChat()
  const chat = getConversation(chatId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const onShow = (e: { endCoordinates?: { height?: number } }) => {
      const h = Number(e?.endCoordinates?.height || 0)
      setKeyboardHeight(h)
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    }
    const onHide = () => setKeyboardHeight(0)
    const subShow = Keyboard.addListener(showEvent, onShow)
    const subHide = Keyboard.addListener(hideEvent, onHide)
    return () => {
      subShow.remove()
      subHide.remove()
    }
  }, [])

  const title = chat?.name || 'Chat'

  useEffect(() => {
    if (chatId) markRead(chatId)
  }, [chatId, markRead])

  const onSend = useCallback(async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    setSendError('')
    try {
      await sendMessage(chatId, value)
      setText('')
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }, [chatId, sendMessage, sending, text])

  const pickAttachment = useCallback(async () => {
    if (sending) return
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setSending(true)
    setSendError('')
    try {
      await sendAttachment(chatId, {
        uri: asset.uri,
        name: asset.name || `file-${Date.now()}`,
        mimeType: asset.mimeType || 'application/octet-stream',
      })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSending(false)
    }
  }, [chatId, sendAttachment, sending])

  if (!chat) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Conversation not found</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        <FlatList
          ref={listRef}
          data={chat.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, keyboardHeight > 0 ? { paddingBottom: 8 } : null]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.isMine || item.from === String(user?.id || '')
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  {item.text ? (
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                  ) : null}
                  {(item.attachments || []).map((attachment: ChatAttachment) => (
                    <AttachmentBubble
                      key={`${item.id}-${attachment.fileName}`}
                      attachment={attachment}
                      mine={mine}
                      styles={styles}
                    />
                  ))}
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {fmtTime(item.time) || new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello.</Text>}
        />

        {sendError ? <Text style={styles.error}>{sendError}</Text> : null}

        <View style={[styles.compose, { paddingBottom: Math.max(insets.bottom, 12) + (Platform.OS === 'android' ? keyboardHeight : 0) }]}>
          <Pressable
            style={styles.attachBtn}
            onPress={pickAttachment}
            disabled={sending}
            accessibilityLabel="Attach file"
            accessibilityRole="button"
          >
            <SymbolView
              name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
              tintColor={branding.colors.primary}
              size={22}
            />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Message… Use @name to mention"
            placeholderTextColor={branding.colors.muted}
            value={text}
            onChangeText={setText}
            onFocus={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
            multiline
            maxLength={4000}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

function createChatDetailStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: b.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: b.colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderBottomLeftRadius: 4 },
  bubbleText: { color: b.colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { marginTop: 4, fontSize: 10, color: b.colors.muted, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  imageAttachment: { width: 220, height: 160, borderRadius: 12, marginTop: 4 },
  fileAttachment: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  fileAttachmentMine: { backgroundColor: 'rgba(255,255,255,0.16)' },
  fileAttachmentLabel: { color: b.colors.text, fontWeight: '700', fontSize: 13 },
  fileAttachmentLabelMine: { color: '#fff' },
  fileAttachmentMeta: { marginTop: 4, fontSize: 11, color: b.colors.muted },
  compose: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: b.colors.text,
    backgroundColor: '#FAFAFA',
  },
  sendBtn: {
    backgroundColor: b.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { textAlign: 'center', color: b.colors.muted, marginTop: 40 },
  error: { color: b.colors.danger, paddingHorizontal: 16, paddingBottom: 4, fontSize: 13 },
  })
}
