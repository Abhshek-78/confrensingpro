import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { io } from "socket.io-client";
import "../styles/VideoMeet.css";
import logoImg from "../utils/confreneview.png";

const server_url = 'http://localhost:8000';
var connections = {};
const peerConfigConnections = {
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ]
};


const Ico = ({ paths, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(paths) ? paths : [paths]).map((d, i) => <path key={i} d={d} />)}
  </svg>
);

const IC = {
  micOn:  ["M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z","M19 10v2a7 7 0 01-14 0v-2","M12 19v4","M8 23h8"],
  micOff: ["M12 1a3 3 0 00-3 3v5","M12 1a3 3 0 013 3v8a3 3 0 01-5.66 1.95M9 9v3a3 3 0 005.12 2.13M19 10v2a7 7 0 01-1.36 4.14","M12 19v4","M8 23h8","M3 3l18 18"],
  vidOn:  "M15 10l4.55-2.28A1 1 0 0121 8.72v6.56a1 1 0 01-1.45.89L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z",
  vidOff: ["M15 10l4.55-2.28A1 1 0 0121 8.72v6.56a1 1 0 01-1.45.89L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z","M3 3l18 18"],
  scrOn:  ["M13 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9","M8 21h8","M12 17v4","M17 1l4 4-4 4","M21 5H11"],
  scrOff: ["M13 3H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9","M8 21h8","M12 17v4","M3 3l18 18"],
  chat:   "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  people: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M23 21v-2a4 4 0 00-3-3.87","M9 7a4 4 0 100 8 4 4 0 000-8z","M16 3.13a4 4 0 010 7.75"],
  hand:   "M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8l4 4h4.5a1.5 1.5 0 001.5-1.5v0a1.5 1.5 0 00-1.5-1.5H17",
  end:    ["M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6z","M23 1L1 23"],
  send:   "M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z",
  close:  "M18 6L6 18M6 6l12 12",
  link:   ["M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71","M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"],
};

/* ── Control button ─────────────────────────────────── */
const Btn = ({ icon, label, onClick, active, danger, badge, disabled }) => (
  <button
    className={['cp-btn', active ? 'cp-btn--on' : '', danger ? 'cp-btn--danger' : '', disabled ? 'cp-btn--disabled' : ''].filter(Boolean).join(' ')}
    onClick={onClick}
    title={label}
    disabled={disabled}
  >
    <span className="cp-btn__ring">
      <Ico paths={icon} size={21} />
      {badge > 0 && <span className="cp-btn__badge">{badge}</span>}
    </span>
    <span className="cp-btn__lbl">{label}</span>
  </button>
);


export default function VideoMeet() {
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoRef = useRef();
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState([]);
  let [audio, setAudio] = useState();
  let [screen, setScreen] = useState();
  let [screenAvailable, setScreenAvailable] = useState();
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  const videoRef = useRef([]);
  let [videos, setVideos] = useState([]);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [meetSec, setMeetSec] = useState(0);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef(null);

  
  useEffect(() => {
    if (!askForUsername) {
      const t = setInterval(() => setMeetSec(s => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [askForUsername]);

  const fmtTime = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  //taking permission of harware device like camera autio
  const getPermission = async () => {
    try {
      const VideoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoAvailable(!!VideoPermission);

      const AudioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioAvailable(!!AudioPermission);

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable
        });

        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getPermission();
  }, []);

  let getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id].setLocalDescription(description)
          .then(() => {
            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
          })
          .catch(e => console.log(e));
      });
    }

    stream.getTracks().forEach(track => track.onended = () => {
      setVideo(false);
      setAudio(false);

      try {
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      } catch (e) {
        console.log(e);
      }

      let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
      window.localStream = blackSilence();
      localVideoRef.current.srcObject = window.localStream;

      for (let id in connections) {
        connections[id].addStream(window.localStream);
        connections[id].createOffer().then((description) => {
          connections[id].setLocalDescription(description)
            .then(() => {
              socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }));
            }).catch(e => console.log(e));
        });
      }
    });
  };

  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  let black = ({ width = 540, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .catch((e) => { console.log(e); });
    } else {
      try {
        let tracks = localVideoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      } catch (e) { }
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [audio, video]);

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
          if (signal.sdp.type === 'offer') {
            connections[fromId].createAnswer().then((description) => {
              connections[fromId].setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }));
                }).catch(e => console.log(e));
            }).catch(e => console.log(e));
          }
        }).catch(e => console.log(e));
      }
      if (signal.ice) {
        connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
      }
    }
  };

  let addMessage = (data, sender, socketIdSender) => {
    setMessages(prevMessages => [...prevMessages, {
      sender, data,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages(prev => prev + 1);
    }
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    socketRef.current.on('signal', gotMessageFromServer);

    socketRef.current.on('connect', () => {
      socketRef.current.emit("join call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on('chat message', addMessage);

      socketRef.current.on('user left', (id) => {
        setVideos(videos => videos.filter(video => video.socketId !== id));
      });

      socketRef.current.on('user join', (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate != null) {
              socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };

          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(v => v.socketId === socketListId);

            if (videoExists) {
              setVideos(videos => {
                const updatedVideos = videos.map(v =>
                  v.socketId === socketListId ? { ...v, stream: event.stream } : v
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoPlay: true,
                playsinline: true
              };
              setVideos(videos => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try {
              connections[id2].addStream(window.localStream);
            } catch (e) { }

            connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit('signal', id2, JSON.stringify({
                    'sdp': connections[id2].localDescription
                  }));
                })
                .catch(e => console.log(e));
            });
          }
        }
      });
    });
  };

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

 
  const totalCount = videos.length + 1;
  const gridCols = totalCount === 1 ? 1
    : totalCount === 2 ? 2
    : totalCount <= 4 ? 2
    : totalCount <= 6 ? 3
    : 4;

  const toggleVideo = () => {
    const track = window.localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoEnabled(track.enabled);
  };

  const toggleAudio = () => {
    const track = window.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsAudioEnabled(track.enabled);
  };

  const toggleScreenShare = async () => {
    if (!isSharingScreen) {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const st = ss.getVideoTracks()[0];
        st.onended = () => stopScreenShare();
        for (let id in connections) {
          const sender = connections[id].getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(st);
        }
        localVideoRef.current.srcObject = ss;
        window.screenStream = ss;
        setIsSharingScreen(true);
        setScreen(ss);
      } catch (e) { console.log(e); }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    window.screenStream?.getTracks().forEach(t => t.stop());
    const camTrack = window.localStream?.getVideoTracks()[0];
    if (camTrack) {
      for (let id in connections) {
        const sender = connections[id].getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      }
      localVideoRef.current.srcObject = window.localStream;
    }
    setIsSharingScreen(false);
    setScreen(null);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socketRef.current?.emit('chat message', message, username || 'You');
    addMessage(message, username || 'You', socketIdRef.current);
    setMessage("");
  };

  const endCall = () => {
    window.localStream?.getTracks().forEach(t => t.stop());
    socketRef.current?.disconnect();
    setVideos([]);
    setAskForUsername(true);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openChat = () => {
    setShowChat(true);
    setShowPeople(false);
    setNewMessages(0);
  };

 
  return (
    <div className="cp-app">

      {askForUsername ? (
        <div className="cp-lobby">
          <div className="cp-lobby__glow" />

          <div className="cp-lobby__brand">
            <div className="cp-lobby__logo-row">
              <img src={logoImg} alt="Conferencing Pro Logo" className="logo-img" />
              <h2 className="cp-lobby__logo-txts" >Conferencing</h2>
              <span className="cp-lobby__logo-txt">Pro</span>
            </div>
            <p className="cp-lobby__tagline">Speak Any Language, Build Every Deal</p>
          </div>

          <div className="cp-lobby__card">
            <p className="cp-lobby__card-lbl">Camera Preview</p>
            <div className="cp-lobby__preview-wrap">
              <video ref={localVideoRef} autoPlay muted className="cp-lobby__preview" />
            </div>

            <TextField
              label="Your display name"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connect()}
              variant="outlined"
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#EDE9E2',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  '& fieldset': { borderColor: 'rgba(201,168,76,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(201,168,76,0.6)' },
                  '&.Mui-focused fieldset': { borderColor: '#C9A84C' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(237,233,226,0.5)', fontFamily: "'Plus Jakarta Sans', sans-serif" },
                '& .MuiInputLabel-root.Mui-focused': { color: '#C9A84C' },
              }}
            />

            <button className="cp-lobby__join" onClick={connect}>
              Enter Meeting <span className="cp-lobby__arrow">→</span>
            </button>
          </div>
        </div>

      ) : (
      /* ─────────────── MEETING ROOM ─────────────── */
      <div className="cp-room">

        {/* Header */}
        <header className="cp-header">
          <div className="cp-header__left">
            <span className="cp-header__brand">ConferencingPro</span>
            <span className="cp-header__divider" />
            <span className="cp-header__timer">{fmtTime(meetSec)}</span>
            <span className="cp-header__dot" />
            <span className="cp-header__count">{totalCount} participant{totalCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="cp-header__right">
            {handRaised && <span className="cp-header__hand">✋ Hand Raised</span>}
            <button className="cp-header__copy-btn" onClick={copyLink}>
              <Ico paths={IC.link} size={13} />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </header>

       
        <div className="cp-main">

         
          <div className="cp-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>

         
            <div className="cp-tile cp-tile--local">
              <video ref={localVideoRef} autoPlay muted className="cp-tile__vid" />
              {!isVideoEnabled && (
                <div className="cp-tile__blank">
                  <span className="cp-tile__av">{(username || 'Y')[0].toUpperCase()}</span>
                </div>
              )}
              {isSharingScreen && <span className="cp-tile__share-tag">🖥 Sharing</span>}
              <div className="cp-tile__foot">
                <span className="cp-tile__name">{username || 'You'}</span>
                <span className="cp-tile__you-tag">YOU</span>
                {!isAudioEnabled && <span>🔇</span>}
                {handRaised && <span>✋</span>}
              </div>
            </div>

          
            {videos.map((vid) => (
              <div key={vid.socketId} className="cp-tile">
                <video
                  data-socket={vid.socketId}
                  ref={ref => {
                    if (ref && vid.stream) {
                      ref.srcObject = vid.stream;
                    }
                  }}
                  autoPlay
                  className="cp-tile__vid"
                />
                <div className="cp-tile__foot">
                  <span className="cp-tile__name">{vid.socketId.slice(0, 8)}…</span>
                </div>
              </div>
            ))}
          </div>

          {/* Side panel */}
          {(showChat || showPeople) && (
            <aside className="cp-panel">
              <div className="cp-panel__hd">
                <span className="cp-panel__title">{showChat ? '💬 Chat' : '👥 Participants'}</span>
                <button className="cp-panel__close" onClick={() => { setShowChat(false); setShowPeople(false); }}>
                  <Ico paths={IC.close} size={17} />
                </button>
              </div>

              {showChat && (
                <>
                  <div className="cp-chat__msgs">
                    {messages.length === 0 && <p className="cp-chat__empty">No messages yet — say hello!</p>}
                    {messages.map((m, i) => (
                      <div key={i} className={`cp-chat__msg${m.sender === (username || 'You') ? ' cp-chat__msg--me' : ''}`}>
                        <span className="cp-chat__who">{m.sender}</span>
                        <span className="cp-chat__bubble">{m.data}</span>
                        <span className="cp-chat__ts">{m.time}</span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="cp-chat__bar">
                    <input
                      className="cp-chat__input"
                      placeholder="Type a message…"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button className="cp-chat__send" onClick={sendMessage}>
                      <Ico paths={IC.send} size={17} />
                    </button>
                  </div>
                </>
              )}

              {showPeople && (
                <div className="cp-ppl">
                  <div className="cp-ppl__item cp-ppl__item--host">
                    <span className="cp-ppl__av">{(username || 'Y')[0].toUpperCase()}</span>
                    <div className="cp-ppl__info">
                      <span className="cp-ppl__name">{username || 'You'}</span>
                      <span className="cp-ppl__role">Host · You</span>
                    </div>
                    <span className="cp-ppl__icons">{isAudioEnabled ? '🎙' : '🔇'} {isVideoEnabled ? '📹' : '🚫'}</span>
                  </div>
                  {videos.map(v => (
                    <div key={v.socketId} className="cp-ppl__item">
                      <span className="cp-ppl__av">{v.socketId[0].toUpperCase()}</span>
                      <div className="cp-ppl__info">
                        <span className="cp-ppl__name">{v.socketId.slice(0, 10)}…</span>
                        <span className="cp-ppl__role">Participant</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Control bar */}
        <footer className="cp-bar">
          <div className="cp-bar__grp">
            <Btn icon={isAudioEnabled ? IC.micOn : IC.micOff}
                 label={isAudioEnabled ? 'Mute' : 'Unmute'}
                 onClick={toggleAudio}
                 active={!isAudioEnabled} />
            <Btn icon={isVideoEnabled ? IC.vidOn : IC.vidOff}
                 label={isVideoEnabled ? 'Stop Video' : 'Start Video'}
                 onClick={toggleVideo}
                 active={!isVideoEnabled} />
          </div>

          <div className="cp-bar__grp">
            <Btn icon={isSharingScreen ? IC.scrOff : IC.scrOn}
                 label={isSharingScreen ? 'Stop Share' : 'Share Screen'}
                 onClick={toggleScreenShare}
                 active={isSharingScreen}
                 disabled={!screenAvailable} />
            <Btn icon={IC.chat}
                 label="Chat"
                 onClick={openChat}
                 active={showChat}
                 badge={newMessages} />
            <Btn icon={IC.people}
                 label="Participants"
                 onClick={() => { setShowPeople(p => !p); setShowChat(false); }}
                 active={showPeople} />
            <Btn icon={IC.hand}
                 label={handRaised ? 'Lower Hand' : 'Raise Hand'}
                 onClick={() => setHandRaised(h => !h)}
                 active={handRaised} />
          </div>

          <div className="cp-bar__grp">
            <Btn icon={IC.end}
                 label="End Call"
                 onClick={endCall}
                 danger />
          </div>
        </footer>
      </div>
      )}
    </div>
  );
}