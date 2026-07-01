import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';

/**
 * VibeRoomVoice — Universal 2-20 Player voice/video bar.
 *
 * Implements the "Focus System" from
 * `Universal_2-20_Player_Integration.pdf` (2026-02-06):
 *
 *   - audio is always-on for every joined peer
 *   - video tiles are rendered ONLY for the top 4 active speakers when
 *     the room has > 4 peers. Smaller rooms (≤ 4) render every tile.
 *   - layout switches between an `overlay-grid` (≤4) and a
 *     `sidebar-grid` (>4) so 20-player tables don't crash mobile.
 *
 * Signaling is done over a WebSocket at
 *   wss://<host>/api/vibe-room/ws/{room_id}/{user_id}
 * (mounted by `routes/vibe_room_signaling.py`). Media is real WebRTC
 * P2P — STUN-only by default (`stun:stun.l.google.com:19302` +
 * `stun:stun1.l.google.com:19302`). For symmetric NATs the embedding
 * deployment can swap in a TURN server via the `iceServers` prop.
 *
 * Negotiation rule: when two peers both know about each other, the one
 * with the **lexicographically smaller** user_id sends the SDP offer.
 * This avoids glare (both sides sending an offer simultaneously).
 */

export interface VibeRoomVoiceProps {
  roomId: string;
  userId: string;
  userName?: string;
  /** Hard cap for visible video tiles when capacity > 4 (PDF spec: 4). */
  maxFocusTiles?: number;
  /** Optional ICE server overrides (e.g. provide a TURN server). */
  iceServers?: RTCIceServer[];
  onClose?: () => void;
}

interface PeerInfo {
  user_id: string;
  is_talking: boolean;
}

/**
 * Default ICE servers — STUN-first with public TURN fallback.
 *
 * STUN handles ~85% of NAT traversal scenarios. The remaining ~15%
 * (symmetric NATs, restrictive corporate firewalls, mobile carrier-NAT
 * deployments) require a TURN relay. We ship with the free, no-account
 * OpenRelay TURN servers from `openrelay.metered.ca` as a sensible
 * default so live human QA can land voice/video over carrier-NAT
 * networks. Production deployments should swap in their own TURN
 * credentials via the `iceServers` prop or the
 * `REACT_APP_TURN_URL/USER/PASS` env-var triplet (read below) — public
 * relays are rate-limited and not recommended for steady-state
 * production traffic.
 */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = (() => {
  const stuns: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  // Pull a private TURN config from env if present.
  const turnUrl = (process.env.REACT_APP_TURN_URL || '').trim();
  const turnUser = (process.env.REACT_APP_TURN_USER || '').trim();
  const turnPass = (process.env.REACT_APP_TURN_PASS || '').trim();
  if (turnUrl) {
    stuns.push({ urls: turnUrl, username: turnUser || undefined, credential: turnPass || undefined });
  } else {
    // Public free OpenRelay fallback (no account needed). Single
    // bundle covers UDP/TCP/TLS so we get through most corporate
    // firewalls. Anonymous + rate-limited; replace in production.
    stuns.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }
  return stuns;
})();

const VOICE_ACTIVITY_THRESHOLD = 0.045;

const VibeRoomVoice: React.FC<VibeRoomVoiceProps> = ({
  roomId,
  userId,
  userName,
  maxFocusTiles = 4,
  iceServers = DEFAULT_ICE_SERVERS,
  onClose,
}) => {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [muted, setMuted] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  // Push-to-Talk: when ON, mic stays disabled until user holds the PTT
  // hotkey (spacebar). Default OFF so existing flows aren't disrupted.
  const [pushToTalk, setPushToTalk] = useState<boolean>(false);
  const [pttPressed, setPttPressed] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const sendWS = useCallback((payload: object) => {
    const w = wsRef.current;
    if (w && w.readyState === WebSocket.OPEN) w.send(JSON.stringify(payload));
  }, []);

  // ------------------------------------------------ helper: create a peer
  const createPeer = useCallback(
    (remoteId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers });
      // Forward our local tracks if we already have a stream.
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          try {
            pc.addTrack(track, localStreamRef.current);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.debug('VibeRoomVoice addTrack', err);
          }
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendWS({
            type: 'rtc_signal',
            to: remoteId,
            signal: { kind: 'ice', candidate: e.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (e) => {
        let stream = remoteStreamsRef.current[remoteId];
        if (!stream) {
          stream = new MediaStream();
          remoteStreamsRef.current[remoteId] = stream;
        }
        // Replace any existing track of the same kind to avoid duplicates.
        stream.getTracks().forEach((t) => {
          if (t.kind === e.track.kind) stream.removeTrack(t);
        });
        stream.addTrack(e.track);
        // Re-render so the <video>/<audio> tag picks up the stream.
        forceUpdate();
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed' ||
          pc.connectionState === 'disconnected'
        ) {
          // eslint-disable-next-line no-console
          console.debug(`VibeRoomVoice pc[${remoteId}] state=${pc.connectionState}`);
        }
      };

      peersRef.current[remoteId] = pc;
      return pc;
    },
    [iceServers, sendWS],
  );

  const closePeer = useCallback((remoteId: string) => {
    const pc = peersRef.current[remoteId];
    if (pc) {
      try {
        pc.close();
      } catch {
        /* swallow */
      }
      delete peersRef.current[remoteId];
    }
    delete remoteStreamsRef.current[remoteId];
    forceUpdate();
  }, []);

  const initiateOffer = useCallback(
    async (remoteId: string) => {
      // Glare avoidance — only the smaller user_id sends an offer.
      if (userId >= remoteId) return;
      const pc = peersRef.current[remoteId] || createPeer(remoteId);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        sendWS({ type: 'rtc_signal', to: remoteId, signal: { kind: 'sdp', sdp: pc.localDescription } });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('VibeRoomVoice initiateOffer', err);
      }
    },
    [userId, createPeer, sendWS],
  );

  // ------------------------------------------------ handle inbound signal
  const handleRtcSignal = useCallback(
    async (fromId: string, signal: { kind: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      let pc = peersRef.current[fromId];
      if (!pc) pc = createPeer(fromId);
      try {
        if (signal.kind === 'sdp' && signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendWS({ type: 'rtc_signal', to: fromId, signal: { kind: 'sdp', sdp: pc.localDescription } });
          }
        } else if (signal.kind === 'ice' && signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            // eslint-disable-next-line no-console
            console.debug('VibeRoomVoice addIceCandidate', err);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('VibeRoomVoice handleRtcSignal', err);
      }
    },
    [createPeer, sendWS],
  );

  // ----------------------------------------------------------------- WS
  useEffect(() => {
    const apiUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    const proto = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const host = apiUrl.replace(/^https?:\/\//, '');
    const url = `${proto}://${host}/api/vibe-room/ws/${encodeURIComponent(roomId)}/${encodeURIComponent(userId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (evt) => {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'peer_list': {
          const list = (msg.peers as { user_id: string }[] | undefined) || [];
          setPeers(list.map((p) => ({ user_id: p.user_id, is_talking: false })));
          // Initiate offers to all existing peers (we are the new joiner).
          for (const p of list) initiateOffer(p.user_id);
          break;
        }
        case 'peer_joined': {
          const uid = msg.user_id as string;
          setPeers((p) => (p.find((x) => x.user_id === uid) ? p : [...p, { user_id: uid, is_talking: false }]));
          // Existing peer initiates if its id is smaller; otherwise the
          // new joiner will offer to us via its own peer_list.
          initiateOffer(uid);
          break;
        }
        case 'peer_left': {
          const uid = msg.user_id as string;
          setPeers((p) => p.filter((x) => x.user_id !== uid));
          setActiveSpeakers((s) => s.filter((id) => id !== uid));
          closePeer(uid);
          break;
        }
        case 'speaker_update': {
          const uid = msg.user as string;
          const active = !!msg.active;
          setPeers((p) => p.map((x) => (x.user_id === uid ? { ...x, is_talking: active } : x)));
          if (active) setActiveSpeakers((s) => (s.includes(uid) ? s : [...s, uid]));
          else setActiveSpeakers((s) => s.filter((id) => id !== uid));
          break;
        }
        case 'rtc_signal': {
          handleRtcSignal(msg.from as string, msg.signal as { kind: string });
          break;
        }
        default:
          break;
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        /* swallow */
      }
      // Tear down all peer connections on unmount.
      for (const id of Object.keys(peersRef.current)) closePeer(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  // -------------------------------------------------- mic + VAD + retro-add tracks to PCs
  const attachLocalTracksToAllPeers = (stream: MediaStream) => {
    for (const [, pc] of Object.entries(peersRef.current)) {
      const senders = pc.getSenders();
      for (const track of stream.getTracks()) {
        const existing = senders.find((s) => s.track?.kind === track.kind);
        if (existing) {
          try {
            existing.replaceTrack(track);
          } catch {
            /* swallow */
          }
        } else {
          try {
            pc.addTrack(track, stream);
          } catch {
            /* swallow */
          }
        }
      }
      // Re-negotiate after track changes.
      if (userId < (Object.entries(peersRef.current).find(([, p]) => p === pc)?.[0] || '')) {
        // The "smaller id" side renegotiates.
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            const remoteId = Object.entries(peersRef.current).find(([, p]) => p === pc)?.[0];
            if (remoteId) sendWS({ type: 'rtc_signal', to: remoteId, signal: { kind: 'sdp', sdp: offer } });
          })
          .catch(() => {/* swallow */});
      }
    }
  };

  const startMic = async () => {
    try {
      const stream =
        localStreamRef.current ||
        (await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
      localStreamRef.current = stream;
      // Attach audio track to all current peer connections.
      attachLocalTracksToAllPeers(stream);

      // Voice-activity detection via Web Audio RMS.
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastEmit = false;
        let lastEmitAt = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const isSpeaking = rms > VOICE_ACTIVITY_THRESHOLD;
          const now = Date.now();
          if (isSpeaking !== lastEmit || (isSpeaking && now - lastEmitAt > 1500)) {
            lastEmit = isSpeaking;
            lastEmitAt = now;
            sendWS({ type: 'voice_activity', active: isSpeaking });
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
      setMuted(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('VibeRoomVoice mic error', err);
    }
  };

  const stopMic = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    // Disable audio tracks rather than tearing the stream down so the
    // existing PC senders don't have to renegotiate.
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setMuted(true);
    sendWS({ type: 'voice_activity', active: false });
  };

  const enableVideo = async () => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      const track = camStream.getVideoTracks()[0];
      if (!track) return;
      localVideoTrackRef.current = track;
      // Add track to combined local stream so the local <video> mirror works.
      if (!localStreamRef.current) localStreamRef.current = new MediaStream();
      localStreamRef.current.addTrack(track);
      // Mirror onto local <video> tag.
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      // Re-attach to all peers (will replaceTrack or addTrack).
      attachLocalTracksToAllPeers(localStreamRef.current);
      setVideoEnabled(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('VibeRoomVoice camera error', err);
    }
  };

  const disableVideo = () => {
    const track = localVideoTrackRef.current;
    if (track) {
      try {
        track.stop();
      } catch {
        /* swallow */
      }
      localStreamRef.current?.removeTrack(track);
      // Replace track with null on all peer senders so remotes see "no video".
      for (const pc of Object.values(peersRef.current)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          try {
            sender.replaceTrack(null);
          } catch {
            /* swallow */
          }
        }
      }
      localVideoTrackRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setVideoEnabled(false);
  };

  // -------------------------------------------------- cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic();
      try {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        /* swallow */
      }
      try {
        audioCtxRef.current?.close();
      } catch {
        /* swallow */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------- Push-to-Talk hotkey
  // When PTT is enabled, hold space to broadcast. Skip when the user is
  // typing in any input/textarea/contentEditable so we don't hijack chat
  // composers.
  useEffect(() => {
    if (!pushToTalk) return;
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setPttPressed(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isTypingTarget(e.target)) return;
      setPttPressed(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      setPttPressed(false);
    };
  }, [pushToTalk]);

  // Drive mic open/close from PTT state when active.
  useEffect(() => {
    if (!pushToTalk) return;
    if (pttPressed) {
      // Open mic if not already streaming, then unmute audio tracks.
      if (!localStreamRef.current) {
        startMic();
      } else {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        setMuted(false);
      }
    } else if (!muted) {
      // Mute on key-up — don't tear stream down so re-engage is instant.
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      sendWS({ type: 'voice_activity', active: false });
      setMuted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pttPressed, pushToTalk]);

  // -------------------------------------------------- Focus System layout
  const allPeers: PeerInfo[] = useMemo(
    () => [{ user_id: userId, is_talking: !muted && activeSpeakers.includes('__local__') }, ...peers],
    [peers, userId, muted, activeSpeakers],
  );

  const visiblePeers: PeerInfo[] = useMemo(() => {
    const capacity = allPeers.length;
    if (capacity <= maxFocusTiles) return allPeers;
    const local = allPeers.find((p) => p.user_id === userId);
    const remoteSpeaking = peers.filter((p) => activeSpeakers.includes(p.user_id));
    const focus: PeerInfo[] = [];
    if (local) focus.push(local);
    for (const r of remoteSpeaking) {
      if (focus.length >= maxFocusTiles) break;
      focus.push(r);
    }
    return focus;
  }, [allPeers, peers, activeSpeakers, userId, maxFocusTiles]);

  const useSidebar = allPeers.length > maxFocusTiles;

  // Whenever the visible-peer list changes, attach remote streams to
  // their <video> tags via ref. (React doesn't let us bind srcObject
  // declaratively.)
  useEffect(() => {
    for (const p of visiblePeers) {
      if (p.user_id === userId) continue;
      const el = remoteVideoRefs.current[p.user_id];
      const stream = remoteStreamsRef.current[p.user_id];
      if (el && stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    }
  });

  // -------------------------------------------------- render
  return (
    <div
      data-testid="vibe-room-voice"
      data-room-id={roomId}
      data-peer-count={allPeers.length}
      data-layout={useSidebar ? 'sidebar-grid' : 'overlay-grid'}
      className="rounded-2xl bg-black/70 backdrop-blur-md border border-cyan-400/30 p-2 sm:p-3"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">
          <Users className="w-3 h-3" />
          <span>
            Vibe Room · {allPeers.length}/20{' '}
            {connected ? (
              <span className="text-emerald-300">● live</span>
            ) : (
              <span className="text-amber-300">● connecting</span>
            )}
            {pushToTalk && (
              <span
                className={`ml-2 ${pttPressed ? 'text-emerald-300' : 'text-amber-300/80'}`}
                data-testid="vibe-room-ptt-hint"
              >
                · {pttPressed ? 'TALKING' : 'Hold SPACE'}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPushToTalk((v) => !v)}
            data-testid="vibe-room-ptt-toggle"
            data-active={pushToTalk ? 'true' : 'false'}
            aria-pressed={pushToTalk}
            title={pushToTalk ? 'Push-to-Talk ON · hold SPACE to talk' : 'Enable Push-to-Talk (hold SPACE)'}
            className={`px-2 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase tracking-wider transition ${
              pushToTalk
                ? pttPressed
                  ? 'bg-emerald-400 text-black shadow-[0_0_18px_rgba(110,231,183,0.6)]'
                  : 'bg-amber-500/30 text-amber-200 hover:bg-amber-500/40'
                : 'bg-white/10 hover:bg-white/20 text-white/70'
            }`}
          >
            PTT
          </button>
          <button
            type="button"
            onClick={muted ? startMic : stopMic}
            data-testid="vibe-room-mic-toggle"
            data-active={muted ? 'false' : 'true'}
            aria-pressed={!muted}
            disabled={pushToTalk}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              muted
                ? 'bg-white/10 hover:bg-white/20 text-white/70'
                : 'bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/40'
            } ${pushToTalk ? 'opacity-40 cursor-not-allowed' : ''}`}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={videoEnabled ? disableVideo : enableVideo}
            data-testid="vibe-room-video-toggle"
            data-active={videoEnabled ? 'true' : 'false'}
            aria-pressed={videoEnabled}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              videoEnabled
                ? 'bg-cyan-500/30 text-cyan-200 hover:bg-cyan-500/40'
                : 'bg-white/10 hover:bg-white/20 text-white/70'
            }`}
            aria-label={videoEnabled ? 'Hide video' : 'Show video'}
          >
            {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-rose-500/30 text-white/50 hover:text-rose-200 transition text-xs font-bold"
              aria-label="Collapse voice bar"
              data-testid="vibe-room-close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div
        className={
          useSidebar
            ? 'flex gap-2 overflow-x-auto pb-1 sidebar-grid'
            : 'grid grid-cols-2 sm:grid-cols-4 gap-2 overlay-grid'
        }
        data-testid="vibe-room-tiles"
      >
        {visiblePeers.map((p) => {
          const isLocal = p.user_id === userId;
          const speaking = isLocal ? !muted && activeSpeakers.includes('__local__') : p.is_talking;
          const stream = isLocal ? localStreamRef.current : remoteStreamsRef.current[p.user_id];
          const hasVideo =
            !!stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
          return (
            <div
              key={p.user_id}
              data-testid="vibe-room-tile"
              data-user-id={p.user_id}
              data-speaking={speaking ? 'true' : 'false'}
              data-has-video={hasVideo ? 'true' : 'false'}
              className={`vibe-video-card shrink-0 w-[72px] h-[72px] sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl flex flex-col items-center justify-center text-xs font-bold relative overflow-hidden border-2 transition ${
                speaking
                  ? 'border-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.55)]'
                  : 'border-white/10'
              } bg-gradient-to-br from-violet-900/60 via-fuchsia-900/40 to-cyan-900/40`}
            >
              {hasVideo ? (
                <video
                  ref={(el) => {
                    if (isLocal) {
                      localVideoRef.current = el;
                      if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                        el.srcObject = localStreamRef.current;
                      }
                    } else {
                      remoteVideoRefs.current[p.user_id] = el;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={isLocal}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl text-white/90 font-black">
                    {(isLocal ? userName || 'You' : p.user_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="text-[9px] uppercase tracking-wide text-white/70 truncate w-full text-center px-1">
                    {isLocal ? 'You' : p.user_id.slice(0, 8)}
                  </div>
                </>
              )}
              {speaking && (
                <span
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    boxShadow:
                      '0 0 0 2px rgba(110,231,183,0.6), 0 0 24px rgba(110,231,183,0.45)',
                  }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        {/* Hidden audio tags so off-focus peers' audio stays live even when
            their video tile isn't rendered (audio-always-on rule). */}
        {peers
          .filter((p) => !visiblePeers.find((vp) => vp.user_id === p.user_id))
          .map((p) => {
            const stream = remoteStreamsRef.current[p.user_id];
            return (
              <audio
                key={`hidden-audio-${p.user_id}`}
                data-testid="vibe-room-hidden-audio"
                data-user-id={p.user_id}
                ref={(el) => {
                  if (el && stream && el.srcObject !== stream) {
                    el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
              />
            );
          })}
      </div>
    </div>
  );
};

export default VibeRoomVoice;
