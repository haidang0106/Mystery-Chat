export interface User {
    id: string; // Socket ID
}

export interface UserProfile {
    name: string;
    age: string;
    gender: 'male' | 'female' | 'other';
}

export interface MatchPreferences {
    preferredGender: 'male' | 'female' | 'other' | 'any';
}

export interface JoinQueuePayload {
    profile: UserProfile;
    preferences: MatchPreferences;
}

export interface MatchSuccessPayload {
    roomId: string;
    partnerId: string;
    partnerProfile: UserProfile;
}

export interface ChatMessage {
    id: string; // Unique message ID
    senderId: string;
    text: string;
    timestamp: number;
}

export interface ServerToClientEvents {
    match_success: (payload: MatchSuccessPayload) => void;
    receive_message: (message: ChatMessage) => void;
    partner_disconnected: () => void;
}

export interface ClientToServerEvents {
    join_queue: (payload: JoinQueuePayload) => void;
    send_message: (text: string) => void;
    leave_chat: () => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    userId: string;
}
