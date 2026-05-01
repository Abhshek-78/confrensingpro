import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { io } from "socket.io-client";
import "../styles/VideoMeet.css";

const server_url = 'http://localhost:8000';
var connections = {};
const peerConfigConnections = {
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" }  
  ]
};

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
                  socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription })); // FIX 5: socketIdRef → socketRef
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
    setMessages(prevMessages => [...prevMessages, { sender, data }]);
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
              setVideos(videos => {                       // FIX 9: param was "video" shadowing state
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

            // FIX 10: createOffer was inside catch — it should always run for the joiner
            connections[id2].createOffer().then((description) => {
              connections[id2].setLocalDescription(description) // FIX 3 again
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

  // Calculate grid columns based on total participant count
  const totalCount = videos.length + 1; // +1 for local video
  const gridCols = totalCount === 1 ? 1
    : totalCount === 2 ? 2
    : totalCount <= 4 ? 2
    : totalCount <= 6 ? 3
    : 4;

  const styles = {
    appWrap: {
      fontFamily: "'Segoe UI', sans-serif",
      background: '#0d0d0d',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
    },
    // ── LOBBY ──────────────────────────────────────────────
    
lobbyWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '20px',
      background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
    },
    lobbyTitle: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: '#fff',
      margin: 0,
    },
    lobbyPreview: {
      width: '320px',
      borderRadius: '12px',
      background: '#000',
      border: '2px solid #333',
      display: 'block',
    },
    lobbyLabel: { color: '#888', fontSize: '13px', marginBottom: '6px', textAlign: 'center' },

    // ── MEETING ROOM ────────────────────────────────────────
    meetHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      background: '#161616',
      borderBottom: '1px solid #2a2a2a',
    },
    meetTitle: { fontSize: '1rem', fontWeight: 600, color: '#ccc', margin: 0 },
    meetBadge: {
      background: '#1e3a5f',
      color: '#7ec8f7',
      borderRadius: '20px',
      padding: '3px 12px',
      fontSize: '12px',
      fontWeight: 600,
    },

    // ── VIDEO GRID ──────────────────────────────────────────
    videoGrid: {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
      gap: '8px',
      padding: '12px',
      alignItems: 'center',
      background: '#0d0d0d',
    },
    videoTile: {
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      aspectRatio: '16/9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoEl: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    nameTag: {
      position: 'absolute',
      bottom: '10px',
      left: '10px',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      padding: '3px 10px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 500,
      color: '#fff',
      pointerEvents: 'none',
    },
    youBadge: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: '#1a4fd6',
      padding: '2px 8px',
      borderRadius: '5px',
      fontSize: '11px',
      fontWeight: 600,
      color: '#fff',
    },
  };

  return (
    <div style={styles.appWrap}>

      {/* ── LOBBY ── */}
      {askForUsername ? (
        <div style={styles.lobbyWrap}>
          <h2 style={styles.lobbyTitle}>📹 Join Meeting</h2>

          <TextField
            label="Your Name"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            variant="outlined"
            size="small"
            sx={{
              width: 260,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: '#444' },
                '&:hover fieldset': { borderColor: '#888' },
                '&.Mui-focused fieldset': { borderColor: '#4a90d9' },
              },
              '& .MuiInputLabel-root': { color: '#888' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#4a90d9' },
            }}
          />

          <Button
            variant="contained"
            onClick={connect}
            sx={{
              background: '#1a4fd6',
              borderRadius: '8px',
              padding: '8px 32px',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '15px',
              '&:hover': { background: '#1440b0' },
            }}
          >
            Join Now
          </Button>

          {/* Camera preview */}
          <div>
            <p style={styles.lobbyLabel}>Camera preview</p>
            <video ref={localVideoRef} autoPlay muted style={styles.lobbyPreview} />
          </div>
        </div>

      ) : (
        /* ── MEETING ROOM ── */
        <>
          {/* Top bar */}
          <div style={styles.meetHeader}>
            <p style={styles.meetTitle}>📹 Meeting Room</p>
            <span style={styles.meetBadge}>{totalCount} participant{totalCount !== 1 ? 's' : ''}</span>
          </div>

          {/* All videos in one responsive grid */}
          <div style={styles.videoGrid}>

            {/* Local (your) video tile — always first */}
            <div style={styles.videoTile}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                style={styles.videoEl}
              />
              <div style={styles.nameTag}>{username || 'You'}</div>
              <div style={styles.youBadge}>YOU</div>
            </div>

            {/* Remote participants — each rendered in the same grid */}
            {videos.map((vid) => (
              <div key={vid.socketId} style={styles.videoTile}>
                <video
                  data-socket={vid.socketId}
                  ref={ref => {
                    if (ref && vid.stream) {
                      ref.srcObject = vid.stream;
                    }
                  }}
                  autoPlay
                  style={styles.videoEl}
                />
                <div style={styles.nameTag}>{vid.socketId}</div>
              </div>
            ))}

          </div>
        </>
      )}
    </div>
  );
}