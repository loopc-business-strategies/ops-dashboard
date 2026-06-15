import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker'
import { attachmentRequestUrl, getAuthToken } from '@/src/api/client'
import { mgBranding } from '@/src/config/branding'
import { useChat } from '@/src/context/ChatContext'
import { useAuth } from '@/src/context/AuthContext'
import type { ChatAttachment } from '@/src/types/chat'
import { formatAttachmentSize } from '@/src/utils/chat'
import { fmtTime } from '@/src/utils/format'

function AttachmentBubble({ attachment, mine }: { attachment: ChatAttachment; mine: boolean }) {
  const token = getAuthToken()
  const url = attachment.fileName ? attachmentRequestUrl(attachment.fileName) : ''
  const label = attachment.originalName || attachment.fileName || 'Attachment'

  if (attachment.kind === 'image' && url && token) {
    return (
      <Image
        source={{ uri: url, headers: { Authorization: `Bearer ${token}` } }}
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
  const { chatId: rawChatId } = useLocalSearchParams<{ chatId: string }>()
  const chatId = decodeURIComponent(String(rawChatId || ''))
  const { user } = useAuth()
  const { getConversation, markRead, sendMessage, sendAttachment } = useChat()
  const chat = getConversation(chatId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const listRef = useRef<FlatList>(null)

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

  const pickImage = useCallback(async () => {
    if (sending) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setSending(true)
    setSendError('')
    try {
      await sendAttachment(chatId, {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSending(false)
    }
  }, [chatId, sendAttachment, sending])

  const pickDocument = useCallback(async () => {
    if (sending) return
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={chat.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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

        <View style={[styles.compose, { paddingBottom: 12 + insets.bottom }]}>
          <Pressable style={styles.attachBtn} onPress={pickImage} disabled={sending}>
            <Text style={styles.attachBtnText}>📷</Text>
          </Pressable>
          <Pressable style={styles.attachBtn} onPress={pickDocument} disabled={sending}>
            <Text style={styles.attachBtnText}>📎</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Message… Use @name to mention"
            placeholderTextColor={mgBranding.colors.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { marginBottom: 10, flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: mgBranding.colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderBottomLeftRadius: 4 },
  bubbleText: { color: mgBranding.colors.text, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { marginTop: 4, fontSize: 10, color: mgBranding.colors.muted, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  imageAttachment: { width: 220, height: 160, borderRadius: 12, marginTop: 4 },
  fileAttachment: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  fileAttachmentMine: { backgroundColor: 'rgba(255,255,255,0.16)' },
  fileAttachmentLabel: { color: mgBranding.colors.text, fontWeight: '700', fontSize: 13 },
  fileAttachmentLabelMine: { color: '#fff' },
  fileAttachmentMeta: { marginTop: 4, fontSize: 11, color: mgBranding.colors.muted },
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
  attachBtnText: { fontSize: 18 },
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
    color: mgBranding.colors.text,
    backgroundColor: '#FAFAFA',
  },
  sendBtn: {
    backgroundColor: mgBranding.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { textAlign: 'center', color: mgBranding.colors.muted, marginTop: 40 },
  error: { color: mgBranding.colors.danger, paddingHorizontal: 16, paddingBottom: 4, fontSize: 13 },
})
