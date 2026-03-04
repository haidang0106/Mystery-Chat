import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  ChatMessage,
  MatchSuccessPayload,
  UserProfile,
  MatchPreferences
} from '../shared/types';

// Connect to localhost backend.
// Note: On Android emulator, localhost is 10.0.2.2.
// For Physical devices it should be the local network IP.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

// Shared theme constants
const THEME = {
  primary: '#3713ec',
  bgLight: '#131022',   // background-dark
  textDark: '#f1f5f9',  // light text for dark mode
  textMuted: '#94a3b8', // muted text for dark mode
  border: '#334155',    // border dark slate
  white: '#1e293b',     // surface dark slate
  danger: '#ef4444'
};

export default function App() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [matchingState, setMatchingState] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ name: '', age: '', gender: 'male' });
  const [preferences, setPreferences] = useState<MatchPreferences>({ preferredGender: 'any' });
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL);

    setSocket(newSocket);

    // Socket.io standard events
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setMatchingState('idle');
      setPartnerId(null);
      setPartnerProfile(null);
    };

    // Custom events
    const onMatchSuccess = (payload: MatchSuccessPayload) => {
      setMatchingState('matched');
      setPartnerId(payload.partnerId);
      setPartnerProfile(payload.partnerProfile);
      setMessages([]); // Clear previous chat
    };

    const onReceiveMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    };

    const onPartnerDisconnected = () => {
      setMatchingState('idle');
      setPartnerId(null);
      setPartnerProfile(null);
      alert('Your partner has disconnected. You are back at the home screen.');
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('match_success', onMatchSuccess);
    newSocket.on('receive_message', onReceiveMessage);
    newSocket.on('partner_disconnected', onPartnerDisconnected);

    // Cleanup on unmount or Fast Refresh - VERY IMPORTANT pattern as per agents.md
    return () => {
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('match_success', onMatchSuccess);
      newSocket.off('receive_message', onReceiveMessage);
      newSocket.off('partner_disconnected', onPartnerDisconnected);
      newSocket.disconnect();
    };
  }, []);

  const handleJoinQueue = () => {
    if (socket && connected) {
      if (!profile.name.trim() || !profile.age.trim()) {
        alert('Please enter your name and age before finding a partner.');
        return;
      }
      setMatchingState('searching');
      socket.emit('join_queue', { profile, preferences });
    }
  };

  const handleLeaveChat = () => {
    if (socket && connected) {
      socket.emit('leave_chat');
      setMatchingState('idle');
      setPartnerId(null);
      setPartnerProfile(null);
      setMessages([]);
    }
  };

  const handleSendMessage = () => {
    if (socket && currentMessage.trim() && matchingState === 'matched') {
      const text = currentMessage.trim();
      socket.emit('send_message', text);

      // Add message locally
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          senderId: socket.id || 'me',
          text,
          timestamp: Date.now()
        }
      ]);
      setCurrentMessage('');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = socket && item.senderId === socket.id;
    const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperPartner]}>
        {!isMe && (
          <View style={styles.messageAvatar}>
            <MaterialIcons name="person" size={20} color={THEME.white} />
          </View>
        )}
        <View style={[styles.messageContent, isMe ? styles.messageContentMe : styles.messageContentPartner]}>
          <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimePartner]}>
            {!isMe && `${partnerProfile?.name || 'Người lạ'}, `}{timeString}
          </Text>
          <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messagePartner]}>
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextPartner]}>
              {item.text}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (matchingState === 'matched') {
    return (
      <SafeAreaView style={styles.chatContainer}>
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Chat Header matching 2.html */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <TouchableOpacity onPress={handleLeaveChat} style={styles.iconButton}>
                <MaterialIcons name="arrow-back" size={24} color={THEME.textDark} />
              </TouchableOpacity>
              <View style={styles.headerAvatar}>
                <MaterialIcons name="person" size={24} color={THEME.white} />
              </View>
              <View>
                <Text style={styles.headerTitle}>{partnerProfile?.name || 'Người lạ ẩn danh'}</Text>
                {partnerProfile && (
                  <Text style={styles.headerSubtitle}>
                    {partnerProfile.age} tuổi • {partnerProfile.gender === 'male' ? 'Nam' : partnerProfile.gender === 'female' ? 'Nữ' : 'Khác'}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={handleLeaveChat} style={styles.endButton}>
              <Text style={styles.endButtonText}>Kết thúc</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListHeaderComponent={() => (
              <View style={styles.systemMessageContainer}>
                <Text style={styles.systemMessageText}>Cuộc trò chuyện đã bắt đầu</Text>
              </View>
            )}
          />

          {/* Chat Input Area matching 2.html */}
          <View style={styles.chatInputContainer}>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialIcons name="add-circle" size={24} color={'#94a3b8'} />
            </TouchableOpacity>

            <View style={styles.chatInputWrapper}>
              <TextInput
                style={styles.chatInput}
                value={currentMessage}
                onChangeText={setCurrentMessage}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor={'#94a3b8'}
                multiline
                maxLength={500}
                onKeyPress={(e) => {
                  const nativeEvent = e.nativeEvent as any;
                  // On Web, Enter sends the message. Shift+Enter creates a newline.
                  if (Platform.OS === 'web' && nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
                    e.preventDefault();
                    if (currentMessage.trim()) {
                      handleSendMessage();
                    }
                  }
                }}
              />
              <TouchableOpacity style={styles.emojiButton}>
                <MaterialIcons name="emoji-emotions" size={24} color={'#94a3b8'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.chatSendButton, !currentMessage.trim() && { backgroundColor: '#1e293b' }]}
              onPress={handleSendMessage}
              disabled={!currentMessage.trim()}
            >
              <MaterialIcons name={currentMessage.trim() ? "send" : "mic"} size={22} color={currentMessage.trim() ? THEME.white : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (matchingState === 'searching') {
    // Searching UI matching 4.html
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={handleLeaveChat} style={styles.iconButtonWrapper}>
            <MaterialIcons name="arrow-back" size={24} color={THEME.textDark} />
          </TouchableOpacity>
          <Text style={styles.searchTitle}>Đang tìm kiếm...</Text>
          <View style={{ width: 48 }} /> {/* Placeholder for balance */}
        </View>

        <View style={styles.searchContent}>
          <View style={styles.radarContainer}>
            {/* Pulse layers */}
            <View style={[styles.radarLayer, { width: 200, height: 200, backgroundColor: 'rgba(55,19,236,0.1)' }]} />
            <View style={[styles.radarLayer, { width: 140, height: 140, borderWidth: 2, borderColor: 'rgba(55,19,236,0.2)' }]} />

            {/* Center icon */}
            <View style={styles.radarCenter}>
              <MaterialIcons name="radar" size={48} color={THEME.primary} />
            </View>
          </View>
          <Text style={styles.searchHeadingText}>Đang quét xung quanh</Text>
          <Text style={styles.searchSubText}>Vui lòng đợi một chút...</Text>
        </View>

        <View style={styles.searchBottom}>
          <TouchableOpacity style={styles.cancelSearchButton} onPress={handleLeaveChat}>
            <Text style={styles.cancelSearchText}>Hủy tìm kiếm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Idle UI matching 3.html
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContentWrapper}>
          <View style={styles.welcomeHeader}>
            <Text style={styles.welcomeLogoText}>Mystery Chat</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View style={[styles.statusDot, { backgroundColor: connected ? '#10b981' : THEME.danger }]} />
              <Text style={styles.statusText}>{connected ? 'Đã kết nối máy chủ' : 'Đang mất kết nối...'}</Text>
            </View>
          </View>

          <View style={styles.profileSection}>
            <Text style={styles.welcomeHeading}>Kết nối ngẫu nhiên,{'\n'}trò chuyện chân thực</Text>

            <View style={styles.profileFormBox}>
              <TextInput
                style={styles.modernInput}
                placeholder="Tên của bạn"
                placeholderTextColor={THEME.textMuted}
                value={profile.name}
                onChangeText={text => setProfile(prev => ({ ...prev, name: text }))}
              />
              <TextInput
                style={styles.modernInput}
                placeholder="Tuổi"
                keyboardType="numeric"
                placeholderTextColor={THEME.textMuted}
                value={profile.age}
                onChangeText={text => setProfile(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
              />

              <Text style={styles.formLabel}>Giới tính của bạn</Text>
              <View style={styles.chipGroup}>
                {[{ id: 'male', label: 'Nam' }, { id: 'female', label: 'Nữ' }, { id: 'other', label: 'Khác' }].map(g => (
                  <TouchableOpacity
                    key={`gender-${g.id}`}
                    style={[styles.modernChip, profile.gender === g.id && styles.modernChipActive]}
                    onPress={() => setProfile(prev => ({ ...prev, gender: g.id as any }))}
                  >
                    <Text style={[styles.modernChipText, profile.gender === g.id && styles.modernChipTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Bạn muốn tìm</Text>
              <View style={styles.chipGroup}>
                {[{ id: 'any', label: 'Bất kỳ' }, { id: 'male', label: 'Nam' }, { id: 'female', label: 'Nữ' }, { id: 'other', label: 'Khác' }].map(g => (
                  <TouchableOpacity
                    key={`pref-${g.id}`}
                    style={[styles.modernChip, preferences.preferredGender === g.id && styles.modernChipActive]}
                    onPress={() => setPreferences(prev => ({ ...prev, preferredGender: g.id as any }))}
                  >
                    <Text style={[styles.modernChipText, preferences.preferredGender === g.id && styles.modernChipTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.welcomeBottom}>
            <TouchableOpacity
              style={[styles.modernButton, !connected && { opacity: 0.5 }]}
              onPress={handleJoinQueue}
              disabled={!connected}
            >
              <Text style={styles.modernButtonText}>Bắt đầu ngay</Text>
              <MaterialIcons name="arrow-forward" size={20} color={THEME.white} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            <Text style={styles.termsText}>Bằng cách bắt đầu, bạn đồng ý với Điều khoản và Chính sách của chúng tôi.</Text>
          </View>
        </View>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bgLight,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#131022',
  },
  // ----- Chat Screen (2.html) -----
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    backgroundColor: 'rgba(19, 16, 34, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    zIndex: 10,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  endButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(55, 19, 236, 0.1)',
  },
  endButtonText: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  systemMessageText: {
    fontSize: 12,
    color: THEME.textMuted,
    backgroundColor: THEME.white,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageList: {
    padding: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  messageWrapperMe: {
    justifyContent: 'flex-end',
  },
  messageWrapperPartner: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '75%',
  },
  messageContentMe: {
    alignItems: 'flex-end',
  },
  messageContentPartner: {
    alignItems: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 4,
  },
  messageTimeMe: {
    marginRight: 4,
  },
  messageTimePartner: {
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageMe: {
    backgroundColor: THEME.primary,
    borderBottomRightRadius: 4,
  },
  messagePartner: {
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#ffffff', // Explicitly bright white for primary background
  },
  messageTextPartner: {
    color: THEME.textDark,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: THEME.bgLight,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  chatInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 24,
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 8,
    marginHorizontal: 8,
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    fontSize: 15,
    color: THEME.textDark,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  emojiButton: {
    padding: 8,
  },
  chatSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // ----- Searching Screen (4.html) -----
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
  },
  iconButtonWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textDark,
  },
  searchContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  radarLayer: {
    position: 'absolute',
    borderRadius: 999,
  },
  radarCenter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(55,19,236,0.1)',
    borderWidth: 2,
    borderColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  searchHeadingText: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textDark,
    marginBottom: 8,
  },
  searchSubText: {
    fontSize: 16,
    color: THEME.textMuted,
  },
  searchBottom: {
    padding: 24,
    paddingBottom: 40,
  },
  cancelSearchButton: {
    height: 56,
    backgroundColor: THEME.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelSearchText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textDark,
  },

  // ----- Welcome Screen (3.html mixed with inputs) -----
  welcomeContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContentWrapper: {
    width: '100%',
    maxWidth: 500,
  },
  welcomeHeader: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 20 : 0,
    marginBottom: 40,
  },
  welcomeLogoText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.primary,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  profileSection: {
    width: '100%',
    marginBottom: 20,
  },
  welcomeHeading: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.textDark,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 36,
  },
  profileFormBox: {
    width: '100%',
  },
  modernInput: {
    height: 52,
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    color: THEME.textDark,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textDark,
    marginBottom: 10,
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  modernChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 24,
  },
  modernChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  modernChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  modernChipTextActive: {
    color: THEME.white,
  },
  welcomeBottom: {
    width: '100%',
    alignItems: 'center',
  },
  modernButton: {
    flexDirection: 'row',
    width: '100%',
    height: 56,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  modernButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.white,
  },
  termsText: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});
